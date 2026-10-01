"use client";

import { useActionState, useState } from "react";
import { jitLogin, type JitLoginState } from "../actions";

export default function JitLoginForm() {
  const [state, action, pending] = useActionState<JitLoginState, FormData>(jitLogin, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="login-form">
      <label>
        <span>JIT ID</span>
        <input name="id" type="text" autoComplete="username" placeholder="Enter your JIT ID" defaultValue={state.id} key={state.id} required />
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
