import React, { useState } from 'react';
import { ConfigProvider, Button, Spin, theme } from 'antd';
import { Plane, Compass, Sparkles } from 'lucide-react';

export default function App() {
  const [loading, setLoading] = useState(false);

  const handleTestClick = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#583f24',      // 本質深木褐
          colorInfo: '#9e7a4e',         // 麥穗金
          colorTextBase: '#2C2A29',     // 炭灰褐
          colorBgBase: '#FAF8F5',       // 暖象牙白
          borderRadius: 4,              // 微直角設計
          fontFamily: '"Noto Sans TC", sans-serif',
        },
        components: {
          Button: {
            borderRadius: 2,            // 按鈕直角化
            controlHeight: 44,
          },
        },
      }}
    >
      <div className="flex min-h-screen items-center justify-center p-4 bg-esence-cream">
        <div className="w-full max-w-md bg-white border border-esence-sand/60 p-8 rounded-lg text-center flex flex-col items-center gap-6 shadow-premium animate-fade-up">
          {/* Header icon with custom pulse anim */}
          <div className="w-16 h-16 rounded-full bg-esence-brown/10 flex items-center justify-center text-esence-brown relative">
            <Plane className="w-8 h-8 rotate-45 relative z-10" />
            <span className="absolute inset-0 rounded-full bg-esence-brown/5 animate-ping opacity-75"></span>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-wider text-esence-dark flex items-center justify-center gap-2 font-serif">
              Traveler <Sparkles className="w-5 h-5 text-esence-gold" />
            </h1>
            <p className="text-esence-dark/70 text-sm mt-2 tracking-wide font-light">
              旅遊行程規劃全新重構版已就緒
            </p>
          </div>

          <hr className="w-full border-esence-sand/60" />

          <div className="w-full flex flex-col gap-4 text-left">
            <div className="bg-esence-cream/40 border border-esence-sand/40 rounded p-4 text-xs text-esence-dark/95 leading-relaxed font-mono">
              <div className="font-semibold text-esence-brown mb-2">// 專案狀態</div>
              <div>• Tailwind CSS v3: 載入成功</div>
              <div>• Ant Design v6: 載入成功</div>
              <div>• Lucide Icons: 載入成功</div>
              <div>• PWA Plugin: 已設定</div>
            </div>

            <Button
              type="primary"
              size="large"
              icon={loading ? <Spin size="small" /> : <Compass className="w-4 h-4 mr-2 inline" />}
              onClick={handleTestClick}
              disabled={loading}
              className="w-full bg-esence-brown hover:bg-esence-gold border-none font-medium h-12 flex items-center justify-center text-white"
            >
              {loading ? '正在測試 Antd 組件...' : '測試 Ant Design & 動效'}
            </Button>
          </div>

          <div className="text-[10px] text-esence-gold tracking-widest uppercase">
            Esence Art Direction Active
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
