import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-900 min-h-screen text-white font-mono z-[9999] relative flex flex-col">
          <h1 className="text-2xl font-bold mb-4">React Error in Staff App</h1>
          <p className="mb-4 text-red-200">Please take a screenshot of this and send it to me:</p>
          <div className="bg-black/50 p-4 rounded overflow-auto flex-1">
            <h2 className="text-xl text-red-400 mb-2">{this.state.error && this.state.error.toString()}</h2>
            <pre className="text-sm whitespace-pre-wrap">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
