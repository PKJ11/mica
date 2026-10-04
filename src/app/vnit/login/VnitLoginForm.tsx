"use client";

import { useActionState, useState } from "react";
import { vnitLogin, type VnitLoginState } from "../actions";
import RollSelect, { type RollOption } from "@/app/login/RollSelect";

export default function VnitLoginForm({ options }: { options: RollOption[] }) {
  const [state, action, pending] = useActionState<VnitLoginState, FormData>(vnitLogin, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="login-form">
      <div className="field">
        <span>Your name</span>
        <RollSelect name="roll" options={options} defaultValue={state.roll} key={state.roll} hideRolls />
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
