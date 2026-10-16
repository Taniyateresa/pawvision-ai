
import { useEffect, useRef, useState } from "react";
import { careGuide, getCare } from "./data/careGuide";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";

// Local development uses localhost.
// Deployment uses the backend URL configured in VITE_API_URL.
const API_BASE = import.meta.env.VITE_API_URL || "";

const API_URL =
  import.meta.env.DEV && !API_BASE
    ? "http://127.0.0.1:8000/predict"
    : `${API_BASE.replace(/\/$/, "")}/predict`;

const MAX_MB = 10;

const STEPS = [
  "Preparing image...",
  "Extracting features...",
  "Identifying breed...",
];

const TABS = [
  ["diet", "Diet"],
  ["exercise", "Exercise"],
  ["grooming", "Grooming"],
  ["care", "General Care"],
];

function prettyName(key) {
  return key
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function photoUrl(key) {
  return `/dogs/${key.toLowerCase().replace(/-/g, "_")}.jpg`;
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
  });
}

function CareGuide({ breedKey, tab, setTab }) {
  const care = getCare(breedKey);

  if (!care) return null;

  return (
    <div className="care-wrap">
      <img
        className="care-photo"
        src={photoUrl(breedKey)}
        alt={prettyName(breedKey)}
      />

      <div>
        <p style={{ color: "var(--muted)" }}>{care.profile}</p>

        <div className="tabs">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              className={"tab" + (tab === k ? " active" : "")}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="care-text">{care[tab]}</div>

        <p className="disclaimer">
          General educational guidance only. This is not veterinary
          advice or a substitute for professional veterinary care.
        </p>
      </div>
    </div>
  );
}

function Top3({ items = [] }) {
  return items.map((p, i) => (
    <div className="top3-row" key={i}>
      <div className="label">
        <span className="who">
          <img
            className="thumb"
            src={photoUrl(p.key)}
            alt=""
          />
          {i + 1}. {p.breed}
        </span>

        <span>{p.confidence}%</span>
      </div>

      <div className="bar">
        <div style={{ width: `${p.confidence}%` }} />
      </div>
    </div>
  ));
}

export default function App() {
  const [file, setFileState] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [careTab, setCareTab] = useState("diet");
  const [browseKey, setBrowseKey] = useState("golden_retriever");

  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    setError("");
    setResult(null);
    clearImage();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setError(
        "Camera access was denied or is not available on this device."
      );
    }
  }

  function capturePhoto() {
    const video = videoRef.current;

    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Could not capture the photo. Please try again.");
      return;
    }

    context.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not capture the photo. Please try again.");
          return;
        }

        setImage(
          new File([blob], "camera.jpg", {
            type: "image/jpeg",
          })
        );

        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  }

  function clearImage() {
    setPreviewUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      return "";
    });

    setFileState(null);
  }

  function setImage(selectedFile) {
    setError("");
    setResult(null);

    if (!selectedFile) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        selectedFile.type
      )
    ) {
      setError("Please choose a JPG, PNG or WEBP image.");
      return;
    }

    if (selectedFile.size > MAX_MB * 1024 * 1024) {
      setError(
        `The file is too large. Maximum size is ${MAX_MB} MB.`
      );
      return;
    }

    setPreviewUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      return URL.createObjectURL(selectedFile);
    });

    setFileState(selectedFile);
  }

  function retake() {
    setResult(null);
    setError("");
    clearImage();

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function analyze() {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setError("");
    setStepIdx(0);

    const t1 = setTimeout(() => setStepIdx(1), 700);
    const t2 = setTimeout(() => setStepIdx(2), 1500);

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch(API_URL, {
        method: "POST",
        body: form,
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(
          data.message || `Request failed (${response.status}).`
        );
      }

      setResult(data);
      setCareTab("diet");
    } catch (err) {
      setError(
        err.message ||
          "Could not reach the server. Please check the backend and try again."
      );
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setLoading(false);
    }
  }

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    setImage(event.dataTransfer.files?.[0]);
  }

  const breedKeys = Object.keys(careGuide);

  return (
    <>
      <Navbar />

      <Hero
        onUpload={() => {
          scrollTo("detect");
          inputRef.current?.click();
        }}
      />

      {/* DETECTION WORKSPACE */}
      <section className="section" id="detect">
        <div className="container">
          <h2>Detect a breed</h2>

          <p className="sub">
            Choose a clear photo that shows the dog well.
          </p>

          <div className="card">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => setImage(event.target.files?.[0])}
            />

            {cameraOn && (
              <div className="preview">
                <video ref={videoRef} playsInline muted />

                <div className="actions">
                  <button
                    className="btn btn-primary"
                    onClick={capturePhoto}
                  >
                    Capture
                  </button>

                  <button
                    className="btn btn-ghost"
                    onClick={stopCamera}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!cameraOn && !previewUrl && !loading && (
              <>
                <div
                  className={"dropzone" + (dragOver ? " over" : "")}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <div className="icon">📷</div>

                  <p>
                    <strong>Drag and drop</strong> a dog photo here,
                    or click to browse
                  </p>

                  <p className="hint">
                    JPG, PNG or WEBP, up to {MAX_MB} MB
                  </p>
                </div>

                <div className="actions">
                  <button
                    className="btn btn-outline"
                    onClick={startCamera}
                  >
                    Use Camera
                  </button>
                </div>
              </>
            )}

            {!cameraOn && previewUrl && !loading && (
              <div className="preview">
                <img src={previewUrl} alt="Selected dog" />

                <div className="actions">
                  <button
                    className="btn btn-primary"
                    onClick={analyze}
                  >
                    Analyze Breed
                  </button>

                  <button
                    className="btn btn-ghost"
                    onClick={retake}
                  >
                    Retake / Change
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="progress">
                <div className="spinner" />
                <p className="step">{STEPS[stepIdx]}</p>
              </div>
            )}

            {error && (
              <div
                className="banner error"
                style={{ marginTop: 18 }}
              >
                {error}
              </div>
            )}
          </div>

          {/* PREDICTION RESULTS */}
          {result && !loading && (
            <div className="card" style={{ marginTop: 24 }}>
              {result.status === "success" && (
                <>
                  <div className="banner success">
                    Dog detected and breed identified
                  </div>

                  <div className="result-grid">
                    <div className="preview">
                      <img src={previewUrl} alt="Analyzed dog" />
                    </div>

                    <div>
                      <div className="breed-name">
                        {result.predicted_breed}
                      </div>

                      <div className="conf">
                        Confidence: {result.confidence}%
                      </div>

                      <h3 style={{ marginBottom: 10 }}>
                        Top 3 predictions
                      </h3>

                      <Top3 items={result.top_3_predictions} />
                    </div>
                  </div>

                  <h3 style={{ margin: "26px 0 4px" }}>
                    Care guide: {result.predicted_breed}
                  </h3>

                  <CareGuide
                    breedKey={result.breed_key}
                    tab={careTab}
                    setTab={setCareTab}
                  />
                </>
              )}

              {result.status === "uncertain" && (
                <>
                  <div className="banner uncertain">
                    {result.message}
                  </div>

                  <div className="result-grid">
                    <div className="preview">
                      <img src={previewUrl} alt="Analyzed dog" />
                    </div>

                    <div>
                      <h3 style={{ marginBottom: 10 }}>
                        Closest matches (low confidence)
                      </h3>

                      <Top3
                        items={result.top_3_predictions || []}
                      />

                      <p className="disclaimer">
                        These are only the nearest supported breeds.
                        Try another photo with a clearer, side-on view
                        of the dog.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {[
                "non_dog",
                "poor_quality",
                "error",
              ].includes(result.status) && (
                <div className={"banner " + result.status}>
                  {result.message}
                </div>
              )}

              <div className="actions">
                <button
                  className="btn btn-outline"
                  onClick={retake}
                >
                  Try another photo
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* IMAGE TIPS */}
      <section className="section" id="tips">
        <div className="container">
          <h2>Get a sharper answer</h2>

          <p className="sub">
            The photo matters most. These four habits give the model
            the best chance.
          </p>

          <div className="grid">
            <div className="mini">
              <div className="tip-num">01</div>
              <h3>Use good lighting</h3>
              <p>
                Even daylight, with the dog facing the light. Dark or
                harsh shadows hide the features the model relies on.
              </p>
            </div>

            <div className="mini">
              <div className="tip-num">02</div>
              <h3>Face the camera</h3>
              <p>
                A clear view of the face, ears and muzzle helps most.
                Stay close enough that the dog fills much of the frame.
              </p>
            </div>

            <div className="mini">
              <div className="tip-num">03</div>
              <h3>One dog per photo</h3>
              <p>
                The app gives one prediction per image, so crop to
                the dog you want to identify.
              </p>
            </div>

            <div className="mini">
              <div className="tip-num">04</div>
              <h3>Keep it sharp</h3>
              <p>
                Hold the camera steady. Very blurry, dark or tiny
                images are rejected before any breed is shown.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BREED CARE GUIDE */}
      <section className="section" id="care">
        <div className="container">
          <h2>Breed care guide</h2>

          <p className="sub">
            Browse diet, exercise, grooming and care tips for all
            40 supported breeds.
          </p>

          <div className="card">
            <select
              value={browseKey}
              onChange={(event) => {
                setBrowseKey(event.target.value);
                setCareTab("diet");
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                fontSize: "1rem",
                marginBottom: 14,
              }}
            >
              {breedKeys.map((key) => (
                <option key={key} value={key}>
                  {prettyName(key)}
                </option>
              ))}
            </select>

            <CareGuide
              breedKey={browseKey}
              tab={careTab}
              setTab={setCareTab}
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="container">
          <h2>How it works</h2>

          <p className="sub">
            Every photo goes through a reliability pipeline before
            a breed is shown.
          </p>

          <div className="grid">
            <div className="mini">
              <h3>1. Image check</h3>
              <p>
                The file is validated, and blurry, very dark or tiny
                images are rejected with a clear message.
              </p>
            </div>

            <div className="mini">
              <h3>2. Dog check</h3>
              <p>
                A separate pretrained network confirms there is a dog,
                so cats, people and objects are not given a breed.
              </p>
            </div>

            <div className="mini">
              <h3>3. Feature extraction</h3>
              <p>
                A pretrained ResNet18 turns the image into 512 numbers
                describing its visual features.
              </p>
            </div>

            <div className="mini">
              <h3>4. Breed classifier</h3>
              <p>
                The features are standardized and an SVM classifier
                produces probabilities for the 40 supported breeds.
              </p>
            </div>

            <div className="mini">
              <h3>5. Uncertainty check</h3>
              <p>
                If the model is not confident, the app says the breed
                may not be supported instead of guessing.
              </p>
            </div>

            <div className="mini">
              <h3>6. Top-3 and care</h3>
              <p>
                The three most likely breeds are shown with confidence,
                plus a care guide for the best match.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DATASET AND MODEL EVALUATION */}
      <section className="section" id="about">
        <div className="container">
          <h2>Dataset and model evaluation</h2>

          <p className="sub">
            Trained on 40 breeds from the Stanford Dogs Dataset,
            150 images per breed (4,200 train, 880 validation,
            920 test).
          </p>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 10 }}>
              Classifier comparison (validation set)
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Classifier</th>
                    <th>Accuracy</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1-score</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td>KNN</td>
                    <td>77.61%</td>
                    <td>78.97%</td>
                    <td>77.61%</td>
                    <td>76.71%</td>
                  </tr>

                  <tr>
                    <td><strong>SVM (selected)</strong></td>
                    <td><strong>84.55%</strong></td>
                    <td><strong>84.92%</strong></td>
                    <td><strong>84.55%</strong></td>
                    <td><strong>84.11%</strong></td>
                  </tr>

                  <tr>
                    <td>Decision Tree</td>
                    <td>52.84%</td>
                    <td>53.96%</td>
                    <td>52.84%</td>
                    <td>52.74%</td>
                  </tr>

                  <tr>
                    <td>MLP</td>
                    <td>83.18%</td>
                    <td>83.31%</td>
                    <td>83.18%</td>
                    <td>82.87%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid">
            <div className="mini">
              <h3>Final test results (SVM)</h3>

              <ul>
                <li>Accuracy: 86.09%</li>
                <li>Precision: 86.40%</li>
                <li>Recall: 86.09%</li>
                <li>F1-score: 85.82%</li>
                <li>Top-3 accuracy: 97.61%</li>
              </ul>

              <p style={{ marginTop: 8 }}>
                Held-out test set of the 40 supported breeds, not a
                universal real-world accuracy.
              </p>
            </div>

            <div className="mini">
              <h3>Reliability checks</h3>

              <ul>
                <li>
                  Supported dogs: 93.1% correct among confident answers
                </li>
                <li>Unsupported dogs: 68.6% flagged as uncertain</li>
                <li>Non-dogs: 93.7% rejected</li>
              </ul>

              <p style={{ marginTop: 8 }}>
                Some unsupported breeds that look like a supported one
                can still receive a confident wrong answer.
              </p>
            </div>

            <div className="mini">
              <h3>Most confused breeds</h3>

              <ul>
                <li>Toy vs Miniature Poodle</li>
                <li>Collie vs Shetland Sheepdog</li>
                <li>French Bulldog vs Boston Bull</li>
              </ul>

              <p style={{ marginTop: 8 }}>
                This is why the app shows the top 3 predictions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ AND PRIVACY */}
      <section className="section">
        <div className="container">
          <h2>FAQ and privacy</h2>

          <p className="sub">
            Good to know before you use the app.
          </p>

          <details>
            <summary>Which breeds are supported?</summary>
            <p>
              40 breeds, including Labrador Retriever, Golden Retriever,
              German Shepherd, Beagle, Pug and the three poodle sizes.
              See the Care Guide section for the full list.
            </p>
          </details>

          <details>
            <summary>
              What if my dog is a mixed breed or not on the list?
            </summary>
            <p>
              The app may show an "uncertain" message with the closest
              supported breeds. It does not identify every dog breed.
            </p>
          </details>

          <details>
            <summary>Is the care guide veterinary advice?</summary>
            <p>
              No. It is general educational guidance and not a diagnosis
              or a substitute for a veterinarian.
            </p>
          </details>

          <details>
            <summary>What happens to my photo?</summary>
            <p>
              In this project, your photo is sent to the backend only
              to be analyzed and is not saved.
            </p>
          </details>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          PawVision AI: AI-Powered Dog Breed Detection and Intelligent
          Pet Care System.
        </div>
      </footer>
    </>
  );
}
