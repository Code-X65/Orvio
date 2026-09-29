import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardDescription, CardTitle } from '../components/ui/card';

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean }

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState { return { hasError: true }; }

  public componentDidCatch(): void {
    // Error reporting is connected when the production observability provider is introduced.
  }

  private reset = (): void => this.setState({ hasError: false });

  public render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10"><Card className="w-full max-w-md"><AlertTriangle className="text-amber-300" aria-hidden="true" /><CardTitle className="mt-4">Something went wrong</CardTitle><CardDescription>Try loading this section again. Your data has not been changed.</CardDescription><Button className="mt-6" onClick={this.reset}><RotateCcw size={16} />Try again</Button></Card></main>;
  }
}
