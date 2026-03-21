import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Coin {
    id: number;
    x: number;
    delay: number;
    duration: number;
    rotation: number;
    scale: number;
}

export const CoinAnimation: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [coins, setCoins] = useState<Coin[]>([]);

    useEffect(() => {
        // Generate 20-30 coins
        const coinCount = Math.floor(Math.random() * 10) + 20;
        const newCoins: Coin[] = Array.from({ length: coinCount }).map((_, i) => ({
            id: i,
            x: Math.random() * 100, // vw
            delay: Math.random() * 0.5,
            duration: 1.5 + Math.random(),
            rotation: Math.random() * 360,
            scale: 0.8 + Math.random() * 0.6
        }));

        setCoins(newCoins);

        const timer = setTimeout(() => {
            onComplete();
        }, 3000); // 3 seconds total animation

        return () => clearTimeout(timer);
    }, [onComplete]);

    return createPortal(
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {coins.map(coin => (
                <div
                    key={coin.id}
                    className="absolute top-[-100px] text-4xl"
                    style={{
                        left: `${coin.x}vw`,
                        animation: `fall ${coin.duration}s ${coin.delay}s ease-in forwards`,
                        transform: `rotate(${coin.rotation}deg) scale(${coin.scale})`
                    }}
                >
                    🪙
                </div>
            ))}
            <style>{`
                @keyframes fall {
                    0% {
                        transform: translateY(-100px) rotate(0deg) scale(1);
                        opacity: 1;
                    }
                    80% {
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(110vh) rotate(720deg) scale(0.5);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>,
        document.body
    );
};
