import React, { useState, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import HomePage from './components/HomePage';
import PackingListPage from './components/PackingListPage';
import { customTheme } from './theme'; // 引入已抽出的本質旅行設計主題變數

// 模擬原本專案的 TripPage，後續步驟會再對此頁面進行精細重構
// 這裡先放一個暫時的 Placeholder 頁面，方便首頁點擊行程時能顯示畫面
function TempTripPage({ tripId, onBack }) {
  return (
    <div className="min-h-screen bg-esence-cream flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-serif text-esence-brown mb-4">行程詳細內容</h2>
      <p className="text-esence-dark/70 mb-6 font-light">行程 ID: {tripId} (重構中...)</p>
      <button 
        onClick={onBack}
        className="btn-esence-outline border-esence-brown text-esence-brown hover:bg-esence-brown hover:text-white px-6 py-2 transition-colors"
      >
        返回首頁
      </button>
    </div>
  );
}

/**
 * App 元件 (應用程式主入口)
 * 負責根據網址參數與狀態控制要顯示「首頁」、「行程詳細頁」還是「攜帶清單頁」
 */
export default function App() {
  /**
   * getIdFromUrl 輔助函式
   * 從目前瀏覽器的網址列中解析出 ?id=xxx 的參數值，做為當前選取的行程 ID
   */
  const getIdFromUrl = () => {
    return new URLSearchParams(window.location.search).get('id');
  };

  // activeTripId 狀態：記錄目前正在瀏覽的行程 ID (若為 null 表示在首頁)
  const [activeTripId, setActiveTripId] = useState(getIdFromUrl);
  
  // showPackingList 狀態：控制是否顯示「旅行攜帶清單」頁面
  const [showPackingList, setShowPackingList] = useState(false);

  /**
   * 監聽瀏覽器上一頁/下一頁 (popstate 事件)
   * 當使用者點擊瀏覽器的上一頁時，自動同步網址與 activeTripId 狀態
   */
  useEffect(() => {
    // 當歷史記錄發生改變時觸發的處理函式
    const handlePop = () => {
      setActiveTripId(getIdFromUrl());
    };
    
    window.addEventListener('popstate', handlePop);
    
    // 清除監聽器 (避免記憶體洩漏)
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, []);

  /**
   * handleSelectTrip 處理函式
   * 當使用者在首頁點選某個行程卡片時觸發
   * 將網址加上 ?id=xxx 參數，並切換狀態至該行程
   */
  const handleSelectTrip = (tripId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('id', tripId);
    // pushState 用於在不重新整理網頁的情況下修改瀏覽器歷史記錄與網址
    window.history.pushState({ tripId }, '', url);
    setActiveTripId(tripId);
  };

  /**
   * handleOpenPackingList 處理函式
   * 當使用者在首頁點選「旅行攜帶清單」按鈕時觸發，切換顯示狀態為 true
   */
  const handleOpenPackingList = () => {
    setShowPackingList(true);
  };

  /**
   * handleBackToHome 處理函式
   * 當在行程詳情頁點擊「返回」時觸發，清除網址參數並回到首頁
   */
  const handleBackToHome = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    window.history.pushState({}, '', url);
    setActiveTripId(null);
  };

  // 1. 若 showPackingList 為 true，顯示「旅行攜帶清單」頁面
  if (showPackingList) {
    return (
      <ConfigProvider theme={customTheme}>
        <PackingListPage onBack={() => setShowPackingList(false)} />
      </ConfigProvider>
    );
  }

  // 2. 若 activeTripId 存在，顯示「行程詳情」頁面 (目前使用 TempTripPage 替代)
  if (activeTripId) {
    return (
      <ConfigProvider theme={customTheme}>
        <TempTripPage tripId={activeTripId} onBack={handleBackToHome} />
      </ConfigProvider>
    );
  }

  // 3. 預設情況 (都在首頁且沒打開清單)：顯示「首頁行程清單」
  return (
    <ConfigProvider theme={customTheme}>
      <HomePage 
        onSelectTrip={handleSelectTrip} 
        onOpenPackingList={handleOpenPackingList} 
      />
    </ConfigProvider>
  );
}
