import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GenericErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
          <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 border border-red-500/30">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-red-500/20 p-3 rounded-full">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
            </div>
            
            <h1 className="text-xl font-bold text-center mb-4">¡Vaya! Algo salió mal</h1>
            
            <div className="bg-black/30 p-4 rounded text-sm text-red-300 font-mono mb-6 overflow-auto max-h-40">
              {this.state.error?.message || 'Error desconocido'}
            </div>
            
            <p className="text-gray-400 text-center text-sm mb-6">
              Hemos capturado el error para evitar que la aplicación se cierre por completo.
            </p>

            <div className="flex justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Recargar Aplicación
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GenericErrorBoundary;
