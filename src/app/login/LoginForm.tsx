"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "../actions";
import RollSelect, { type RollOption } from "./RollSelect";

export default function LoginForm({ options }: { options: RollOption[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="login-form">
      <div className="field">
        <span>Roll number</span>
        <RollSelect name="roll" options={options} defaultValue={state.roll} key={state.roll} />
      </div>
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
