import io
import json
import os

import joblib
import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageOps, UnidentifiedImageError
from torchvision import models, transforms

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE, "ml", "models", "dog_breed_model_40")


def pretty(name):
    return name.replace("_", " ").title()


def load_image(data):
    try:
        Image.open(io.BytesIO(data)).verify()
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img).convert("RGB")
        return img
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return None


def check_quality(img):
    """Return a message if the image is unusable, otherwise None."""
    w, h = img.size
    if min(w, h) < 100:
        return "The image is too small. Please upload a larger image showing the dog."

    gray = img.convert("L")
    gray.thumbnail((256, 256))
    a = np.asarray(gray, dtype=np.float32)

    if a.mean() < 35:
        return "The image is too dark. Please upload a brighter image showing the dog."

    lap = (4 * a[1:-1, 1:-1] - a[:-2, 1:-1] - a[2:, 1:-1]
           - a[1:-1, :-2] - a[1:-1, 2:])
    if lap.var() < 100:
        return "The image is too blurry. Please upload a clearer image showing the dog."
    return None


class DogBreedPredictor:
    def __init__(self):
        self.device = torch.device("cpu")

        self.svm = joblib.load(os.path.join(MODEL_DIR, "svm_model.pkl"))
        self.scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
        label_map = joblib.load(os.path.join(MODEL_DIR, "label_map.pkl"))
        with open(os.path.join(MODEL_DIR, "thresholds.json")) as f:
            self.th = json.load(f)

        # Class order exactly as the SVM learned it
        self.keys = [label_map[int(c)] for c in self.svm.classes_]
        self.names = [pretty(k) for k in self.keys]

        # Same preprocessing as validation/test in training
        self.tf = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std=[0.229, 0.224, 0.225]),
        ])

        # ResNet18 feature extractor (512-D)
        self.extractor = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
        self.extractor.fc = nn.Identity()
        self.extractor.to(self.device).eval()

        # ResNet50 dog / non-dog validator
        self.dog_net = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
        self.dog_net.to(self.device).eval()

    @torch.no_grad()
    def predict(self, data):
        img = load_image(data)
        if img is None:
            return {"status": "error",
                    "message": "The file could not be read as an image. Please upload a valid JPG or PNG."}

        msg = check_quality(img)
        if msg:
            return {"status": "poor_quality", "message": msg}

        x = self.tf(img).unsqueeze(0).to(self.device)

        dog_score = float(torch.softmax(self.dog_net(x), dim=1)[0, 151:269].sum())
        if dog_score < self.th["DOG_THRESHOLD"]:
            return {"status": "non_dog",
                    "message": "This image does not appear to contain a dog."}

        feats = self.extractor(x).cpu().numpy()
        probs = self.svm.predict_proba(self.scaler.transform(feats))[0]
        order = np.argsort(probs)[::-1]

        top3 = [{"breed": self.names[i],
                 "key": self.keys[i],
                 "confidence": round(float(probs[i]) * 100, 2)} for i in order[:3]]

        max_p = float(probs[order[0]])
        gap = max_p - float(probs[order[1]])

        if max_p < self.th["PROB_THRESHOLD"] or gap < self.th["GAP_THRESHOLD"]:
            return {"status": "uncertain",
                    "message": "A dog was detected, but the breed may not be among the supported breeds.",
                    "top_3_predictions": top3}

        return {"status": "success",
                "predicted_breed": top3[0]["breed"],
                "breed_key": top3[0]["key"],
                "confidence": top3[0]["confidence"],
                "top_3_predictions": top3}