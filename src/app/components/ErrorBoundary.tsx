import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack || '' });
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          fontFamily: 'monospace',
          backgroundColor: '#1a1a2e',
          color: '#e94560',
          minHeight: '100vh'
        }}>
          <h2 style={{ color: '#e94560', fontSize: '20px' }}>⚠️ Runtime Error Detected</h2>
          <pre style={{
            background: '#16213e',
            padding: '16px',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '13px',
            overflow: 'auto',
            marginTop: '12px'
          }}>
            <strong style={{ color: '#e94560' }}>Error:</strong> {this.state.error?.message}
            {'\n\n'}
            <strong style={{ color: '#ffa07a' }}>Stack:</strong>{'\n'}
            {this.state.error?.stack}
            {'\n\n'}
            <strong style={{ color: '#ffa07a' }}>Component Stack:</strong>{'\n'}
            {this.state.componentStack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null, componentStack: '' })}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#e94560',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
