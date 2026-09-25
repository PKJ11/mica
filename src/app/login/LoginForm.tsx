"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "../actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="login-form">
      <label>
        <span>Roll number</span>
        <input name="roll" defaultValue={state.roll} key={state.roll} inputMode="numeric" autoComplete="username" placeholder="2025XXXXXXX" required />
      </label>
      <label>
        <span>Password</span>
        <div className="pw-row">
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
          <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
