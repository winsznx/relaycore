import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Home, ArrowLeft, Search } from 'lucide-react';
import logo from '@/assets/logo.png';

export function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-6">
            <Card className="max-w-2xl w-full border-0 shadow-2xl">
                <CardContent className="p-12 text-center space-y-8">
                    {/* Logo */}
                    <div className="flex justify-center">
                        <img src={logo} alt="Relay Core" className="h-16 w-16 rounded-xl" />
                    </div>

                    {/* 404 */}
                    <div>
                        <h1 className="text-9xl font-bold text-[#111111] mb-4">404</h1>
                        <h2 className="text-3xl font-bold text-[#111111] mb-2">Page Not Found</h2>
                        <p className="text-lg text-gray-600 max-w-md mx-auto">
                            The page you're looking for doesn't exist or has been moved.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                        <Button
                            onClick={() => navigate(-1)}
                            variant="outline"
                            className="rounded-full px-6"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Go Back
                        </Button>
                        <Button
                            onClick={() => navigate('/')}
                            className="bg-[#111111] text-white hover:bg-black rounded-full px-6"
                        >
                            <Home className="mr-2 h-4 w-4" />
                            Back to Home
                        </Button>
                        <Button
                            onClick={() => navigate('/dashboard')}
                            variant="outline"
                            className="rounded-full px-6"
                        >
                            <Search className="mr-2 h-4 w-4" />
                            Dashboard
                        </Button>
                    </div>

                    {/* Help Text */}
                    <div className="pt-8 border-t">
                        <p className="text-sm">
                            Need help? Visit our{' '}
                            <a href="/#docs" className="text-[#111111] font-medium hover:underline">
                                documentation
                            </a>{' '}
                            or{' '}
                            <a href="mailto:support@relaycore.xyz" className="text-[#111111] font-medium hover:underline">
                                contact support
                            </a>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
