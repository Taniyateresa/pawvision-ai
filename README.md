# AI-Powered Dog Breed Detection and Intelligent Pet Care System

A web application that accepts a dog photo (upload or camera), validates it, confirms a dog is present, identifies the breed among **40 supported breeds**, shows the Top-3 predictions with confidence, and displays a breed-specific care guide.

**Student:** Penki Supriya, B.Tech CSE

## Pipeline

Image -> Quality check -> Dog / non-dog check -> Preprocessing -> ResNet18 (512-D features) -> StandardScaler -> SVM -> Uncertainty check -> Top-3 result + care guide

- **Dog validator:** a separate pretrained ResNet50 (ImageNet). The probability it assigns to the 118 ImageNet dog classes is compared with a threshold chosen on validation data.
- **Feature extractor:** pretrained ResNet18 with the final layer replaced by Identity (512 features).
- **Classifier:** SVM (RBF kernel, C=1, probability=True), chosen after comparing KNN, SVM, Decision Tree and MLP.
- **Uncertainty check:** the top probability must reach a threshold chosen on validation data, otherwise the app reports that the breed may not be supported.

## Dataset

Stanford Dogs Dataset (Kaggle), 40 selected breeds, 150 images each (random seed 42).

| Split | Images |
|---|---|
| Train | 4,200 |
| Validation | 880 |
| Test | 920 |

The dataset itself is not included in this repository.

## Results

Classifier comparison on the **validation** set:

| Classifier | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|
| KNN | 77.61% | 78.97% | 77.61% | 76.71% |
| **SVM** | **84.55%** | **84.92%** | **84.55%** | **84.11%** |
| Decision Tree | 52.84% | 53.96% | 52.84% | 52.74% |
| MLP | 83.18% | 83.31% | 83.18% | 82.87% |

Final **test-set** results for the SVM (held-out, 40 supported breeds):

| Metric | Value |
|---|---|
| Accuracy | 86.09% |
| Precision | 86.40% |
| Recall | 86.09% |
| F1-score | 85.82% |
| Top-3 accuracy | 97.61% |

Most confused breeds: Toy vs Miniature Poodle, Collie vs Shetland Sheepdog, French Bulldog vs Boston Bull.

### End-to-end reliability evaluation

| Group | Result |
|---|---|
| Supported dogs (test set, 920) | 75.7% confident answers; 93.1% of those correct; 23.5% flagged uncertain; 0.9% wrongly called non-dog |
| Unsupported dogs (40 held-out breeds, 1,000 images) | 68.6% flagged uncertain; 5.5% called non-dog; 25.9% given a confident wrong breed |
| Non-dogs (CIFAR-10, 920 images) | 93.7% rejected; 0% given a breed |

Thresholds: DOG_THRESHOLD = 0.35, PROB_THRESHOLD = 0.5, GAP_THRESHOLD = 0.0 (chosen on validation data and held-out tuning breeds).

## Limitations

- Only **40 breeds** are supported. The system does not identify every dog breed.
- The reported accuracy is a held-out test-set result for these 40 breeds, **not** universal real-world accuracy.
- About 1 in 4 unsupported dogs can still receive a confident wrong breed, especially when they resemble a supported breed.
- The non-dog evaluation used small CIFAR-10 images, plus manual tests with real photos.
- One prediction is made per image. Photos with several dogs are not separated.
- The care guide is general educational information, **not veterinary advice**.

## Project structure

```
dog-breed-detection/
├── ml/
│   ├── dog_breed_training.ipynb    training and evaluation notebook (Google Colab)
│   └── models/dog_breed_model_40/  svm_model.pkl, scaler.pkl, label_map.pkl,
│                                   thresholds.json, metadata.json, features.npz,
│                                   confusion_matrix.png
├── backend/
│   ├── main.py                     FastAPI server (POST /predict)
│   └── predictor.py                full inference pipeline
├── frontend/                       React + Vite website
├── tests/                          helper scripts and test images
├── requirements.txt
└── README.md
```

## How to run

Requires Python 3.12 and Node.js.

**1. Backend** (from the project folder)

```
py -3.12 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --app-dir backend --port 8000
```

The first start downloads the pretrained ResNet18 and ResNet50 weights (internet needed once).

**2. Frontend** (in a second terminal)

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173/

## API

`POST /predict` with an image file (JPG, PNG or WEBP, up to 10 MB).

Possible `status` values: `success`, `uncertain`, `non_dog`, `poor_quality`, `error`.

## Tests performed

Supported breed, unsupported breed (Dalmatian), cat, blurry image, very dark image, corrupted file, invalid file type, oversized file, multiple dogs, and browser camera capture.