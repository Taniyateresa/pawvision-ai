export function PawIcon(props) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
      <ellipse cx="9" cy="13" rx="3" ry="4" />
      <ellipse cx="16" cy="9" rx="3" ry="4.2" />
      <ellipse cx="23" cy="13" rx="3" ry="4" />
      <path d="M16 15c-4.5 0-8 3.6-8 7 0 2.4 2 3.5 4 3.5 1.6 0 2.8-.7 4-.7s2.4.7 4 .7c2 0 4-1.1 4-3.5 0-3.4-3.5-7-8-7z" />
    </svg>
  );
}

export default function Navbar() {
  return (
    <nav className="navbar" aria-label="Main">
      <div className="container">
        <a className="brand" href="#top">
          <PawIcon />
          PawVision AI
        </a>
        <div className="nav-links">
          <a href="#detect">Identify</a>
          <a href="#care">Breeds</a>
          <a href="#how">How it works</a>
          <a href="#about">Evaluation</a>
          <a className="btn btn-primary" href="#detect">Try it</a>
        </div>
      </div>
    </nav>
  );
}