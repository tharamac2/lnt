import { QrCode, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import ltLogo from '../../assets/lt-logo.png';

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    setTimeout(onComplete, 200);
                    return 100;
                }
                return prev + 5;
            });
        }, 50); // Will take around 1 second to complete

        return () => clearInterval(timer);
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[100] bg-neutral-950 flex flex-col items-center justify-center overflow-hidden">
            {/* Dynamic Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[128px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/10 rounded-full mix-blend-screen filter blur-[128px] animate-pulse" style={{ animationDelay: '1s' }}></div>

            <div className="relative z-10 flex flex-col items-center">
                <div className="bg-[#134377] p-8 rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/10 shadow-[0_0_40px_rgba(19,67,119,0.5)] mb-8 relative transition-transform duration-700 hover:scale-105 w-48 h-32">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent rounded-3xl opacity-50"></div>
                    <img
                        src={ltLogo}
                        alt="L&T Construction Logo"
                        className="w-full h-full object-contain relative z-10 animate-pulse"
                        style={{ animationDuration: '3s' }}
                    />
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">QR Tool Management</h1>
                <p className="text-blue-400 text-xs font-semibold tracking-[0.3em] uppercase mb-12">Digital Platform</p>

                <div className="w-64 h-1.5 bg-neutral-800 rounded-full overflow-hidden shadow-inner hidden">
                    {/* Kept progress state running, but hiding the bar for a cleaner minimal look */}
                </div>

                <div className="mt-6 flex items-center gap-3 text-neutral-400 text-sm font-medium">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    Initializing Secure Environment...
                </div>
            </div>

            {/* Copyright Footer */}
            <div className="absolute bottom-8 text-center text-xs text-white font-medium opacity-80">
                UJ Enterprises & Tharamac &copy; 2026 QR Tool Management System
            </div>
        </div>
    );
};

export default SplashScreen;
