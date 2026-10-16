import { useState } from "react";
import { PawIcon } from "./Navbar";

const PHOTOS = ["hero1", "hero2", "hero3", "hero4"];

function DogPhoto({ file }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="shot">
      {failed ? (
        <PawIcon className="shot-paw" />
      ) : (
        <img src={`/dogs/${file}.jpg`} alt="A dog" onError={() => setFailed(true)} />
      )}
    </figure>
  );
}

export default function Hero({ onUpload }) {
  return (
    <header className="hero">
      <div className="container">
        <div>
          <h1>Meet your dog's breed, powered by AI.</h1>
          <p>
            Upload a photo and PawVision AI identifies the breed, shows the
            three closest matches, and gives you a care guide for each.
          </p>
          <div className="cta">
            <button className="btn btn-primary" onClick={onUpload}>Identify my dog</button>
            <a className="btn btn-outline" href="#how">See how it works</a>
          </div>
          <ul className="trust">
            <li>Free to use</li>
            <li>Photos are never saved</li>
            <li>Answer in seconds</li>
          </ul>
        </div>
        <div className="collage">
          {PHOTOS.map((file) => (
            <DogPhoto key={file} file={file} />
          ))}
        </div>
      </div>
    </header>
  );
}