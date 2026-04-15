import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-mesh p-4">
          <Card className="p-8 max-w-md w-full bg-card/80 backdrop-blur-sm border-destructive/20">
            <div className="text-center">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h2 className="text-2xl font-bold mb-4 text-foreground">حدث خطأ غير متوقع</h2>
              <p className="text-muted-foreground mb-6">
                نعتذر عن الإزعاج. يرجى إعادة تحميل الصفحة.
              </p>
              {this.state.error && (
                <details className="text-right mb-4 p-4 bg-destructive/10 rounded-lg">
                  <summary className="cursor-pointer text-sm text-destructive">
                    تفاصيل الخطأ
                  </summary>
                  <p className="mt-2 text-xs font-mono text-destructive/80">
                    {this.state.error.message}
                  </p>
                </details>
              )}
              <Button 
                onClick={() => window.location.reload()} 
                className="bg-gradient-primary hover-lift"
              >
                إعادة تحميل الصفحة
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
