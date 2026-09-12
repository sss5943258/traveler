import React, { useState, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import HomePage from './components/HomePage';
import PackingListPage from './components/PackingListPage';
import TripPage from './components/TripPage'; // 引入重構後的排行程頁面
import ProtectedRoute from './components/ProtectedRoute'; // 路由守衛
import LoginPage from './pages/LoginPage'; // 登入頁
import { customTheme } from './theme'; // 引入已抽出的本質旅行設計主題變數
import { useAuthStore } from './stores/authStore'; // 全域登入狀態

/**
 * App 元件 (應用程式主入口)
 * 負責根據網址參數與狀態控制要顯示「首頁」、「行程詳細頁」還是「攜帶清單頁」
 * 
 * 認證流程：
 * 1. App 啟動時讀取 localStorage 的 token，標記 isInitialized = true
 * 2. ProtectedRoute 根據 isInitialized + user 決定顯示 LoginPage 或主畫面
 */
export default function App() {
  const setInitialized = useAuthStore((state) => state.setInitialized);

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
   * App 初始化：從 localStorage 恢復登入狀態
   * authStore 的 loadFromStorage() 在 create() 時已經執行（同步讀取），
   * 這裡只需要標記 isInitialized = true，告訴 ProtectedRoute 可以做判斷了
   */
  useEffect(() => {
    setInitialized();
  }, [setInitialized]);

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

  /**
   * renderMainContent - 渲染主應用內容（登入後才會顯示）
   * 根據狀態決定顯示哪個頁面
   */
  const renderMainContent = () => {
    // 1. 若 showPackingList 為 true，顯示「旅行攜帶清單」頁面
    if (showPackingList) {
      return <PackingListPage onBack={() => setShowPackingList(false)} />;
    }

    // 2. 若 activeTripId 存在，顯示「行程詳情」頁面
    if (activeTripId) {
      return <TripPage tripId={activeTripId} onBack={handleBackToHome} />;
    }

    // 3. 預設：顯示「首頁行程清單」
    return (
      <HomePage 
        onSelectTrip={handleSelectTrip} 
        onOpenPackingList={handleOpenPackingList} 
      />
    );
  };

  return (
    <ConfigProvider theme={customTheme}>
      {/* ProtectedRoute：未登入顯示 LoginPage，已登入顯示主內容 */}
      <ProtectedRoute fallback={<LoginPage />}>
        {renderMainContent()}
      </ProtectedRoute>
    </ConfigProvider>
  );
}

