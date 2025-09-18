import React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Call parent error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <Alert variant="danger" className="m-3">
          <Alert.Heading>
            <FiAlertTriangle className="me-2" />
            Bir hata oluştu
          </Alert.Heading>
          <p>
            Bu bölümde bir hata oluştu ve içerik yüklenemedi.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-3">
              <summary>Hata detayları (geliştirici modu)</summary>
              <pre className="mt-2 small text-muted">
                {this.state.error.toString()}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <hr />
          <div className="d-flex justify-content-end">
            <Button 
              variant="outline-danger" 
              size="sm" 
              onClick={this.handleRetry}
            >
              <FiRefreshCw className="me-2" />
              Tekrar Dene
            </Button>
          </div>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
