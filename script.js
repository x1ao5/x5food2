// 配置設定
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycby8hklVemfDX4HQ_3lZiaded35xt9bvj9K0wrZWc60QXPytIv_PeJJNBaA1iZxKKmkX/exec',
  DEFAULT_IMAGE: 'https://i.ibb.co/qL40sXF3/Chat-GPT-Image-2025-4-5-06-00-55.png',
  MAX_RATING: 5
};

// DOM加載完成後初始化
document.addEventListener('DOMContentLoaded', initApp);

// 初始化應用
async function initApp() {
  try {
    setupRatingSystem();
    bindEventListeners();
    await testConnection();
    await loadRecipes();
  } catch (error) {
    console.error('初始化失敗:', error);
    showMessage(`應用初始化失敗: ${error.message}`, 'error');
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

/* 評分系統設置 */
function setupRatingSystem() {
  setupStarRating('taste-rating', 'taste-rating-value'); // 美味度評分
  setupStarRating('difficulty-rating', 'difficulty-rating-value'); // 難易度評分
}

function setupStarRating(containerId, hiddenInputId) {
  const stars = document.querySelectorAll(`#${containerId} .star`);
  const hiddenInput = document.getElementById(hiddenInputId);
  
  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      const value = index + 1;
      hiddenInput.value = value;
      updateStarsDisplay(stars, value);
    });
  });
}

function updateStarsDisplay(stars, activeCount) {
  stars.forEach((star, index) => {
    star.classList.toggle('active', index < activeCount);
  });
}

/* 事件監聽器綁定 */
function bindEventListeners() {
  // 表單提交
  document.getElementById('recipe-form').addEventListener('submit', handleFormSubmit);
  
  // 搜尋功能
  document.getElementById('search-input').addEventListener('input', debounce(function() {
    searchRecipes(this.value);
  }, 300));
  
  // 取消編輯按鈕
  document.getElementById('cancel-edit').addEventListener('click', resetForm);
  
  // 事件委派處理編輯和刪除
  document.getElementById('records-container').addEventListener('click', function(e) {
    const card = e.target.closest('.record-card');
    if (!card) return;
    
    const recipeId = card.dataset.id;
    if (e.target.classList.contains('btn-edit')) {
      loadRecipeForEditing(recipeId);
    } else if (e.target.classList.contains('btn-delete')) {
      deleteRecipe(recipeId);
    }
  });
}

/* 表單處理 */
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const formData = getFormData();
  const errors = validateForm(formData);
  
  if (errors.length > 0) {
    showMessage(errors.join('<br>'), 'error');
    return;
  }
  
  try {
    showLoading(true);
    if (formData.id) {
      await updateRecipe(formData);
    } else {
      await addRecipe(formData);
    }
    await loadRecipes();
    resetForm();
  } catch (error) {
    console.error('表單提交錯誤:', error);
    showMessage(`操作失敗: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

/* 獲取表單數據 */
function getFormData() {
  return {
    id: document.getElementById('recipe-id').value,
    料理名稱: document.getElementById('dish-name').value.trim(),
    烹飪日期: document.getElementById('cooking-date').value,
    圖片URL: validateUrl(document.getElementById('dish-image').value.trim()),
    美味度: parseInt(document.getElementById('taste-rating-value').value) || 0,
    難易度: parseInt(document.getElementById('difficulty-rating-value').value) || 0,
    食材: document.getElementById('ingredients').value.split(',').map(i => i.trim()).filter(i => i),
    步驟: document.getElementById('steps').value.trim(),
    備註: document.getElementById('notes').value.trim()
  };
}

/* 驗證URL */
function validateUrl(url) {
  if (!url) return CONFIG.DEFAULT_IMAGE;
  try {
    new URL(url);
    return url;
  } catch {
    return CONFIG.DEFAULT_IMAGE;
  }
}

/* 驗證表單 */
function validateForm(formData) {
  const errors = [];
  if (!formData.料理名稱) errors.push('請輸入料理名稱');
  if (!formData.烹飪日期) errors.push('請選擇烹飪日期');
  if (formData.食材.length === 0) errors.push('請至少輸入一種食材');
  if (!formData.步驟) errors.push('請輸入烹飪步驟');
  return errors;
}

// 改進的API請求處理
async function fetchAPI(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    // 不再需要手動設置mode: 'cors'
  };
  
  if (body) options.body = JSON.stringify(body);

  try {
    // 添加時間戳防止緩存
    const url = endpoint.includes('?') 
      ? `${endpoint}&t=${Date.now()}`
      : `${endpoint}?t=${Date.now()}`;
    
    const response = await fetch(url, options);
    
    // 處理GAS的重定向
    if (response.redirected) {
      const finalResponse = await fetch(response.url, options);
      return await finalResponse.json();
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP錯誤! 狀態碼: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API請求失敗:', {
      endpoint,
      error: error.message
    });
    
    // 更詳細的錯誤訊息
    let userMessage = '網絡連接失敗';
    if (error.message.includes('Failed to fetch')) {
      userMessage = `無法連接API伺服器，請檢查:
        1. API URL是否正確
        2. 網路連接是否正常
        3. 後端是否已部署`;
    }
    
    throw new Error(userMessage);
  }
}

// 改進的測試連接函數
async function testConnection() {
  try {
    const response = await fetchAPI(`${CONFIG.API_URL}?test=1`);
    
    if (response.status !== 'success') {
      throw new Error('API返回異常狀態');
    }
    
    // 添加日誌幫助調試
    console.log('API連接測試成功:', response);
    return true;
  } catch (error) {
    console.error('API連接測試失敗:', error);
    
    // 在頁面顯示詳細錯誤
    const testUrl = `${CONFIG.API_URL}?test=1`;
    showMessage(`
      <strong>API連接失敗</strong><br>
      錯誤: ${error.message}<br>
      測試URL: <a href="${testUrl}" target="_blank">${testUrl}</a><br>
      請確認:
      1. 已正確部署GAS腳本
      2. 部署權限設為"任何人"
      3. 使用/exec的URL
    `, 'error', 10000);
    
    throw error;
  }
}

/* 添加食譜 */
async function addRecipe(recipeData) {
  showMessage('正在保存食譜...', 'info');
  
  try {
    const result = await fetchAPI(CONFIG.API_URL, 'POST', {
      action: 'add',
      料理名稱: recipeData.料理名稱,
      烹飪日期: recipeData.烹飪日期,
      圖片URL: recipeData.圖片URL,
      美味度: recipeData.美味度,
      難易度: recipeData.難易度,
      食材: recipeData.食材.join(','),
      步驟: recipeData.步驟,
      備註: recipeData.備註 || ''
    });

    if (result.status !== "success") {
      throw new Error(result.message || '保存失敗');
    }
    
    showMessage('食譜保存成功！', 'success');
    return result.id;
  } catch (error) {
    console.error('保存食譜失敗:', error);
    showMessage(`保存失敗: ${error.message}`, 'error');
    throw error;
  }
}

/* 更新食譜 */
async function updateRecipe(recipeData) {
  showMessage('正在更新食譜...', 'info');
  
  try {
    const result = await fetchAPI(CONFIG.API_URL, 'POST', {
      action: 'update',
      ID: recipeData.id,
      料理名稱: recipeData.料理名稱,
      烹飪日期: recipeData.烹飪日期,
      圖片URL: recipeData.圖片URL,
      美味度: recipeData.美味度,
      難易度: recipeData.難易度,
      食材: recipeData.食材.join(','),
      步驟: recipeData.步驟,
      備註: recipeData.備註 || ''
    });
    
    if (result.status !== 'success') {
      throw new Error(result.message || '更新失敗');
    }
    
    showMessage('食譜更新成功!', 'success');
  } catch (error) {
    console.error('更新食譜失敗:', error);
    showMessage(`更新失敗: ${error.message}`, 'error');
    throw error;
  }
}

/* 刪除食譜 */
async function deleteRecipe(recipeId) {
  if (!confirm('確定要永久刪除此食譜嗎？此操作無法復原！')) return;
  
  try {
    showMessage('正在刪除食譜...', 'info');
    const result = await fetchAPI(CONFIG.API_URL, 'POST', {
      action: 'delete',
      ID: recipeId
    });
    
    if (result.status !== "success") {
      throw new Error(result.message || '刪除失敗');
    }
    
    showMessage('食譜已刪除', 'success');
    await loadRecipes();
  } catch (error) {
    console.error('刪除食譜失敗:', error);
    showMessage(`刪除失敗: ${error.message}`, 'error');
  }
}

/* 載入食譜 */
async function loadRecipes() {
  try {
    showLoading(true);
    const result = await fetchAPI(CONFIG.API_URL);
    
    if (result.status !== 'success') {
      throw new Error(result.message || '載入失敗');
    }
    
    renderRecipes(result.data || []);
    updateRecordsCount(result.data?.length || 0);
    showMessage(`已載入 ${result.data?.length || 0} 個食譜`, 'success', 2000);
  } catch (error) {
    console.error('載入食譜失敗:', error);
    showMessage(`載入失敗: ${error.message}`, 'error');
    renderRecipes([]);
  } finally {
    showLoading(false);
  }
}

/* 渲染食譜列表 */
function renderRecipes(recipes) {
  const container = document.getElementById('records-container');
  
  if (!recipes || recipes.length === 0) {
    const searchText = document.getElementById('search-input').value;
    container.innerHTML = `
      <div class="no-records">
        <img src="${CONFIG.DEFAULT_IMAGE}" alt="暫無記錄">
        <h3>${searchText ? '沒有找到匹配的料理' : '還沒有任何記錄喔～'}</h3>
        <p>快來記錄你的第一道魔法料理吧！</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = recipes.map(recipe => `
    <div class="record-card" data-id="${recipe.ID}">
      <div class="record-header">
        <h3>${recipe.料理名稱}</h3>
        <span class="record-date">${formatDate(recipe.創建時間 || recipe.烹飪日期)}</span>
      </div>
      <div class="record-ratings">
        <div class="rating-item">
          <span>美味度:</span>
          <div class="stars">${renderStars(recipe.美味度)}</div>
        </div>
        <div class="rating-item">
          <span>難易度:</span>
          <div class="stars">${renderStars(recipe.難易度, '✨')}</div>
        </div>
      </div>
      ${recipe.圖片URL ? `<img src="${recipe.圖片URL}" alt="${recipe.料理名稱}">` : ''}
      <div class="recipe-ingredients">
        <h4>食材:</h4>
        <div class="ingredients-list">
          ${recipe.食材.split(',').map(item => `<span>${item.trim()}</span>`).join('')}
        </div>
      </div>
      <div class="recipe-steps">
        <h4>步驟:</h4>
        <p>${recipe.步驟.replace(/\n/g, '<br>')}</p>
      </div>
      ${recipe.備註 ? `<div class="recipe-notes"><h4>備註:</h4><p>${recipe.備註}</p></div>` : ''}
      <div class="recipe-actions">
        <button class="btn-edit">✏️ 編輯</button>
        <button class="btn-delete">🗑️ 刪除</button>
      </div>
    </div>
  `).join('');
}

/* 更新記錄計數 */
function updateRecordsCount(count) {
  const el = document.getElementById('records-count');
  if (el) el.textContent = `${count} 個記錄`;
}

/* 渲染星級評分 */
function renderStars(count, activeChar = '⭐', inactiveChar = '☆') {
  return activeChar.repeat(count) + inactiveChar.repeat(CONFIG.MAX_RATING - count);
}

/* 格式化日期 */
function formatDate(dateString) {
  if (!dateString) return '無日期';
  try {
    return new Date(dateString).toLocaleDateString('zh-TW', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).replace(/\//g, '-');
  } catch {
    return dateString;
  }
}

/* 防抖函數 */
function debounce(func, delay) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, arguments), delay);
  };
}

/* 顯示加載狀態 */
function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

/* 顯示消息 */
function showMessage(text, type = 'info', duration = 3000) {
  const messageBox = document.createElement('div');
  messageBox.className = `message ${type}`;
  messageBox.innerHTML = text;
  document.body.appendChild(messageBox);
  
  setTimeout(() => messageBox.classList.add('show'), 10);
  setTimeout(() => {
    messageBox.classList.remove('show');
    setTimeout(() => messageBox.remove(), 500);
  }, duration);
}

/* 載入食譜用於編輯 */
async function loadRecipeForEditing(recipeId) {
  try {
    showLoading(true);
    const result = await fetchAPI(`${CONFIG.API_URL}?action=getOne&id=${recipeId}`);
    
    if (result.status !== 'success' || !result.data) {
      throw new Error(result.message || '載入失敗');
    }
    
    populateForm(result.data);
    showMessage(`正在編輯: ${result.data.料理名稱}`, 'success');
    document.getElementById('recipe-form').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('載入食譜失敗:', error);
    showMessage(`載入失敗: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

/* 填充表單 */
function populateForm(recipe) {
  document.getElementById('recipe-id').value = recipe.ID;
  document.getElementById('dish-name').value = recipe.料理名稱;
  document.getElementById('cooking-date').value = recipe.烹飪日期;
  document.getElementById('dish-image').value = recipe.圖片URL || '';
  document.getElementById('ingredients').value = recipe.食材;
  document.getElementById('steps').value = recipe.步驟;
  document.getElementById('notes').value = recipe.備註 || '';
  
  // 更新評分顯示
  document.getElementById('taste-rating-value').value = recipe.美味度 || 0;
  document.getElementById('difficulty-rating-value').value = recipe.難易度 || 0;
  updateStarsDisplay(document.querySelectorAll('#taste-rating .star'), recipe.美味度 || 0);
  updateStarsDisplay(document.querySelectorAll('#difficulty-rating .star'), recipe.難易度 || 0);
  
  // 更新按鈕狀態
  document.querySelector('.form-submit-btn').textContent = '💾 更新食譜';
  document.getElementById('cancel-edit').style.display = 'inline-block';
}

/* 重置表單 */
function resetForm() {
  document.getElementById('recipe-form').reset();
  document.getElementById('recipe-id').value = '';
  
  // 重置評分
  document.getElementById('taste-rating-value').value = '0';
  document.getElementById('difficulty-rating-value').value = '0';
  updateStarsDisplay(document.querySelectorAll('#taste-rating .star'), 0);
  updateStarsDisplay(document.querySelectorAll('#difficulty-rating .star'), 0);
  
  // 重置按鈕
  document.querySelector('.form-submit-btn').textContent = '✏️ 新增食譜';
  document.getElementById('cancel-edit').style.display = 'none';
  
  showMessage('表單已重置', 'info', 2000);
}

/* 搜尋食譜 */
async function searchRecipes(keyword) {
  if (!keyword.trim()) {
    await loadRecipes();
    return;
  }
  
  try {
    showLoading(true);
    const result = await fetchAPI(`${CONFIG.API_URL}?search=${encodeURIComponent(keyword)}`);
    
    if (result.status !== 'success') {
      throw new Error(result.message || '搜尋失敗');
    }
    
    renderRecipes(result.data || []);
    updateRecordsCount(result.data.length);
    showMessage(`找到 ${result.data.length} 個匹配結果`, 'success', 2000);
  } catch (error) {
    console.error('搜尋失敗:', error);
    showMessage(`搜尋失敗: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}
