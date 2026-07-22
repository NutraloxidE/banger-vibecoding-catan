import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

// Keeps a single runtime error from blanking the whole game. Offers a reset
// that clears the (possibly corrupt) save and returns to the title screen.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("HEXFALL crashed:", error);
  }

  reset = () => {
    try {
      localStorage.removeItem("hexfall-save-v1");
    } catch {
      /* ignore */
    }
    location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="crash">
          <h1>Something exploded 💥</h1>
          <p>The board reached a state it did not enjoy. Your settings are safe.</p>
          <pre>{String(this.state.error.message)}</pre>
          <button className="btn btn-huge" onClick={this.reset}>
            Reset &amp; return to title
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
