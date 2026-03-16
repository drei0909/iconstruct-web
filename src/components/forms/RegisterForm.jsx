import { useState } from "react";

function RegisterForm() {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log("Register Data:", {
      name,
      email,
      password
    });

    // TODO: connect to Firebase Register
  };

  return (
        <div
            className="container d-flex justify-content-center align-items-center"
            style={{ minHeight: "calc(100vh - 120px)" }}
            >
      <div className="card shadow p-4" style={{ width: "400px" }}>

        <h3 className="text-center mb-4">Register</h3>

        <form onSubmit={handleSubmit}>

          <div className="mb-3">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="Enter full name"
              value={name}
              onChange={(e)=>setName(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="Enter email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Create password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              required
            />
          </div>

        <button type="submit" className="btn btn-success w-100">
        Register
        </button>

        </form>

      </div>
    </div>
  );
}

export default RegisterForm;