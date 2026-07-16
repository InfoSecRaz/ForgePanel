import { useState } from 'react';

// Security checklist: every field rendered through this component is masked by default
// (type="password"), never logged, and only ever toggled to plain text by an explicit
// user click -- the toggle state is local component state, never persisted or sent anywhere.
export default function PasswordInput({ value, onChange, autoComplete = 'off' }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className="input pr-14"
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-label text-text-secondary hover:text-text-primary"
        onClick={() => setShow((v) => !v)}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
