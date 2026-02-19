import React from 'react';

type AppErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crash', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#050505',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <h1>Something went wrong</h1>
        <p>{this.state.message ?? 'Please try reloading the page.'}</p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1.5rem',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.5)',
            background: 'transparent',
            color: '#fff',
          }}
        >
          Reload
        </button>
      </main>
    );
  }
}
