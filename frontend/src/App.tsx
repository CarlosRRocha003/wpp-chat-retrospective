
export default function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>👋 Hello, world!</h1>
      <p>This is a minimal React + TypeScript app (Vite).</p>
      <button
        onClick={() => alert("Hello from the frontend!")}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ccc",
          cursor: "pointer",
        }}
      >
        Click me
      </button>
    </main>
  );
}
