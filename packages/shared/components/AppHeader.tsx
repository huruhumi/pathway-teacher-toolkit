import React from 'react';

export interface NavTab {
    key: string;
    label: string;
    icon: React.ReactNode;
    badge?: number;
}

export interface AppHeaderProps {
    /** App name displayed in the logo */
    appName: string;
    /** Optional subtitle below the app name */
    subtitle?: string;
    /** Logo icon (Lucide component rendered, e.g. <Brain />) */
    logoIcon: React.ReactNode;
    /** Brand color classes: { bg, text, activeBg, activeText, hoverBg } */
    brand: {
        logoBg: string;       // e.g. "bg-gradient-to-br from-violet-600 to-purple-600"
        logoText?: string;     // e.g. "text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600"
        activeBg: string;     // e.g. "bg-violet-100"
        activeText: string;   // e.g. "text-violet-700"
        badgeBg?: string;     // e.g. "bg-violet-200"
        badgeText?: string;   // e.g. "text-violet-700"
    };
    /** Navigation tabs */
    tabs: NavTab[];
    /** Currently active tab key */
    activeTab: string;
    /** Callback when tab is clicked */
    onTabChange: (key: string) => void;
    /** Optional callback when logo is clicked */
    onLogoClick?: () => void;
    /** Optional right-side content (e.g. auth buttons, dark mode toggle) */
    rightContent?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    appName,
    subtitle,
    logoIcon,
    brand,
    tabs,
    activeTab,
    onTabChange,
    onLogoClick,
    rightContent,
}) => {
    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Logo */}
                <div
                    className="flex items-center gap-2.5 cursor-pointer flex-shrink-0"
                    onClick={onLogoClick}
                >
                    <div className={`w-8 h-8 ${brand.logoBg} rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                        {logoIcon}
                    </div>
                    <div className="flex flex-col justify-center">
                        <h1 className={`text-lg font-bold tracking-tight ${brand.logoText || 'text-slate-800'} truncate`}>
                            {appName}
                        </h1>
                        {subtitle && (
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase hidden sm:block">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {/* Center: Pill Tabs (desktop) */}
                <nav className="hidden md:flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => onTabChange(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                ${activeTab === tab.key
                                    ? `bg-white ${brand.activeText} shadow-sm`
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.badge != null && tab.badge > 0 && (
                                <span className={`ml-1 text-[10px] ${brand.badgeBg || 'bg-slate-200'} ${brand.badgeText || 'text-slate-600'} rounded-full px-1.5 py-0.5 font-bold`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Right: mobile tabs + optional content */}
                <div className="flex items-center gap-2">
                    {/* Mobile nav (icons only) */}
                    <div className="flex md:hidden items-center gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => onTabChange(tab.key)}
                                className={`p-2 rounded-lg transition-all ${activeTab === tab.key
                                    ? `${brand.activeBg} ${brand.activeText}`
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                title={tab.label}
                            >
                                {tab.icon}
                                {tab.badge != null && tab.badge > 0 && (
                                    <span className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] text-[8px] ${brand.badgeBg || 'bg-slate-200'} ${brand.badgeText || 'text-slate-600'} rounded-full flex items-center justify-center font-bold`}>
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {rightContent && (
                        <>
                            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
                            {rightContent}
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};
