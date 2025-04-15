// 配置常數
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzhraghr7sgEia8s9bMlC23JtDu8hUk4jrNqEj848G9N3KunOLANaYfBL7R9NG08sx1Xw/exec',
  DEFAULT_IMAGE: 'https://i.ibb.co/qL40sXF3/Chat-GPT-Image-2025-4-5-06-00-55.png',
  MAX_RATING: 5
};

// DOM 加載完成後初始化
document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

function initApp() {
  // 載入現有食譜
  loadRecipes();
  
  // 設置評分系統
  setupRatingSystem();
  
  // 綁定事件監聽器
  bindEventListeners();
  
  // 隱藏加載指示器
  setTimeout(() => {
    document.getElementById('loading').style.display = 'none';
  }, 500);
}

function setupRatingSystem() {
  // 美味度評分
  const tasteStars = document.querySelectorAll('#taste-rating .star');
  const tasteHiddenInput = document.getElementById('taste-rating-value');
  
  // 難易度評分
  const difficultyStars = document.querySelectorAll('#difficulty-rating .star');
  const difficultyHiddenInput = document.getElementById('difficulty-rating-value');
  
  // 設置評分事件
  setupStars(tasteStars, tasteHiddenInput);
  setupStars(difficultyStars, difficultyHiddenInput);
}

function setupStars(stars, hiddenInput) {
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

// 輔助函數：處理食材格式
function formatIngredients(ingredients) {
  if (Array.isArray(ingredients)) return ingredients.filter(i => i);
  if (typeof ingredients === 'string') return ingredients.split(',').map(i => i.trim()).filter(i => i);
  return [];
}

// 輔助函數：處理步驟格式
function formatSteps(steps) {
  if (typeof steps === 'string') return steps.replace(/\n/g, '<br>');
  if (steps) return String(steps).replace(/\n/g, '<br>');
  return '無步驟說明';
}

/**
 * 處理記錄卡片的點擊事件（委派模式）
 */
function handleRecordClick(e) {
  const card = e.target.closest('.record-card');
  if (!card) return;

  const recipeId = card.dataset.id;
  console.log('[Debug] 點擊的卡片ID:', recipeId, '類型:', typeof recipeId);

  // 檢查 ID 是否有效
  if (!recipeId || recipeId === 'undefined' || isNaN(Number(recipeId))) {
    console.error('無效的卡片ID:', card);
    showMessage('錯誤: 食譜ID無效', 'error');
    return;
  }

  // 判斷點擊的是編輯還是刪除按鈕
  if (e.target.classList.contains('btn-edit')) {
    loadRecipeForEditing(recipeId);
  } else if (e.target.classList.contains('btn-delete')) {
    deleteRecipe(recipeId);
  }
}

function bindEventListeners() {
  // 表單提交
  document.getElementById('recipe-form').addEventListener('submit', handleFormSubmit);
  
  // 搜尋功能
  document.getElementById('search-input').addEventListener('input', function() {
    searchRecipes(this.value);
  });
  
  // 取消編輯按鈕
  document.getElementById('cancel-edit').addEventListener('click', resetForm);
  
  // 使用事件委派處理編輯和刪除按鈕
  document.getElementById('records-container').addEventListener('click', function(e) {
    try {
      const card = e.target.closest('.record-card');
      if (!card) return;
      
      // 強化 ID 驗證
      const recipeId = card.dataset.id;
      console.log('[事件委派] 點擊的卡片ID:', recipeId, '類型:', typeof recipeId, '元素:', e.target);
      
      // 檢查是否是有效按鈕點擊
      const isEditBtn = e.target.classList.contains('btn-edit');
      const isDeleteBtn = e.target.classList.contains('btn-delete');
      if (!isEditBtn && !isDeleteBtn) return;
      
      // 驗證 ID 格式
      if (!recipeId || typeof recipeId !== 'string' || !/^\d+$/.test(recipeId)) {
        console.error('[錯誤] 無效的食譜ID格式:', recipeId, '卡片:', card);
        showMessage('操作失敗: 食譜ID格式不正確', 'error');
        return;
      }
      
      const numericId = Number(recipeId);
      if (isNaN(numericId) || numericId <= 0) {
        console.error('[錯誤] 轉換後的ID無效:', numericId);
        showMessage('操作失敗: 食譜ID必須是正數', 'error');
        return;
      }
      
      // 根據按鈕類型處理
      if (isEditBtn) {
        loadRecipeForEditing(numericId);
      } else if (isDeleteBtn) {
        deleteRecipe(numericId);
      }
      
    } catch (error) {
      console.error('[嚴重錯誤] 事件處理異常:', error);
      showMessage('系統錯誤: ' + error.message, 'error');
    }
  });
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  try {
    const formData = getFormData();
    const errors = validateForm(formData);
    
    if (errors.length > 0) {
      showMessage(errors.join('<br>'), 'error');
      return;
    }
    
    // 顯示加載指示器
    document.getElementById('loading').style.display = 'flex';
    
    if (formData.id) {
      await updateRecipe(formData);
    } else {
      await addRecipe(formData);
    }
    
    // 重置表單並刷新列表
    resetForm();
    await loadRecipes();
    
  } catch (error) {
    console.error('表單提交錯誤:', error);
    showMessage(`操作失敗: ${error.message}`, 'error');
  } finally {
    // 隱藏加載指示器
    document.getElementById('loading').style.display = 'none';
  }
}

function getFormData() {
  const ingredientsValue = document.getElementById('ingredients').value;
  const ingredientsArray = ingredientsValue.split(',').map(i => i.trim()).filter(i => i);
  
  return {
    id: document.getElementById('recipe-id').value,
    dishName: document.getElementById('dish-name').value.trim(),
    cookingDate: document.getElementById('cooking-date').value,
    dishImage: document.getElementById('dish-image').value.trim(),
    tasteRating: parseInt(document.getElementById('taste-rating-value').value) || 0,
    difficultyRating: parseInt(document.getElementById('difficulty-rating-value').value) || 0,
    ingredients: ingredientsArray,
    steps: document.getElementById('steps').value.trim(),
    notes: document.getElementById('notes').value.trim()
  };
}

function populateForm(recipe) {
  document.getElementById('recipe-id').value = recipe.ID || '';
  document.getElementById('dish-name').value = recipe.料理名稱 || '';
  document.getElementById('cooking-date').value = recipe.烹飪日期 || '';
  document.getElementById('dish-image').value = recipe.圖片URL || '';
  
  // 設置評分
  const tasteRating = parseInt(recipe.美味度) || 0;
  const difficultyRating = parseInt(recipe.難易度) || 0;
  document.getElementById('taste-rating-value').value = tasteRating;
  document.getElementById('difficulty-rating-value').value = difficultyRating;
  updateStarsDisplay(document.querySelectorAll('#taste-rating .star'), tasteRating);
  updateStarsDisplay(document.querySelectorAll('#difficulty-rating .star'), difficultyRating);
  
  // 設置食材（轉換數組為逗號分隔字符串）
  const ingredients = Array.isArray(recipe.食材) ? recipe.食材.join(', ') : recipe.食材 || '';
  document.getElementById('ingredients').value = ingredients;
  
  document.getElementById('steps').value = recipe.步驟 || '';
  document.getElementById('notes').value = recipe.備註 || '';
  
  // 更新按鈕狀態
  document.querySelector('.form-submit-btn').textContent = '💾 更新食譜';
  document.getElementById('cancel-edit').style.display = 'inline-block';
}

function validateForm(formData) {
  const errors = [];
  
  if (!formData.dishName) errors.push('請輸入料理名稱');
  if (!formData.cookingDate) errors.push('請選擇烹飪日期');
  if (formData.ingredients.length === 0) errors.push('請至少輸入一種食材');
  if (!formData.steps) errors.push('請輸入烹飪步驟');
  
  return errors;
}

// 修改函數
async function addRecipe(recipeData) {
  showMessage('正在保存食譜...', 'info');
  
  try {
    // 準備 URL 編碼的數據
    const formData = new URLSearchParams();
    formData.append('action', 'add');
    formData.append('料理名稱', recipeData.dishName);
    formData.append('烹飪日期', recipeData.cookingDate);
    formData.append('圖片URL', recipeData.dishImage || '');
    formData.append('美味度', recipeData.tasteRating || '0');
    formData.append('難易度', recipeData.difficultyRating || '0');
    formData.append('食材', recipeData.ingredients.join(','));
    formData.append('步驟', recipeData.steps);
    formData.append('備註', recipeData.notes || '');

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    // 處理響應
    const responseText = await response.text();
    let result;
    
    try {
      result = JSON.parse(responseText);
    } catch (error) {
      // 如果解析失敗，嘗試解碼後再解析
      try {
        const decodedText = decodeURIComponent(responseText);
        result = JSON.parse(decodedText);
      } catch (e) {
        throw new Error(`無效的響應格式: ${responseText}`);
      }
    }

    if (!result || result.status !== 'success') {
      throw new Error(result?.message || '保存食譜失敗');
    }
    
    showMessage('食譜保存成功!', 'success');
    return result.data;
    
  } catch (error) {
    console.error('保存食譜錯誤:', error);
    showMessage(`保存失敗: ${error.message}`, 'error');
    throw error;
  }
}

async function updateRecipe(recipeData) {
  showMessage('正在更新食譜...', 'info');
  
  try {
    const formData = new URLSearchParams();
    formData.append('action', 'update');
    formData.append('ID', recipeData.id);
    formData.append('料理名稱', recipeData.dishName);
    formData.append('烹飪日期', recipeData.cookingDate);
    formData.append('圖片URL', recipeData.dishImage || '');
    formData.append('美味度', recipeData.tasteRating || '0');
    formData.append('難易度', recipeData.difficultyRating || '0');
    formData.append('食材', recipeData.ingredients.join(','));
    formData.append('步驟', recipeData.steps);
    formData.append('備註', recipeData.notes || '');

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const result = await response.json();
    
    if (result.status !== 'success') {
      throw new Error(result.message || '更新食譜失敗');
    }
    
    showMessage('食譜更新成功!', 'success');
  } catch (error) {
    console.error('更新食譜錯誤:', error);
    showMessage(`更新失敗: ${error.message}`, 'error');
    throw error;
  }
}

// 安全分割食材字符串
function safeSplitIngredients(ingredients) {
  try {
    if (Array.isArray(ingredients)) {
      return ingredients.filter(item => item && typeof item === 'string');
    }
    if (typeof ingredients === 'string') {
      return ingredients.split(',').map(item => item.trim()).filter(item => item);
    }
    return [];
  } catch (error) {
    console.error('處理食材失敗:', error);
    return [];
  }
}

function renderRecipes(recipes) {
  const container = document.getElementById('records-container');
  
  // 過濾無效食譜
  const validRecipes = recipes.filter(recipe => {
    const isValid = recipe.ID && !isNaN(recipe.ID);
    if (!isValid) console.error('無效食譜:', recipe);
    return isValid;
  });

  if (validRecipes.length === 0) {
    // 顯示無記錄狀態
    container.innerHTML = `
      <div class="no-records">
        <img src="${CONFIG.DEFAULT_IMAGE}" alt="暫無記錄">
        <div class="no-records-text">
          <h3>${document.getElementById('search-input').value ? '沒有找到匹配的料理' : '還沒有任何記錄喔～'}</h3>
          <p>快來記錄你的第一道魔法料理吧！</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = recipes.map(recipe => {
    // 處理食材顯示
    const ingredients = Array.isArray(recipe.食材) 
      ? recipe.食材.join(', ')
      : (recipe.食材 || '無食材資訊');
    
    // 處理評分顯示
    const tasteRating = recipe.美味度 || 0;
    const difficultyRating = recipe.難易度 || 0;
    
    // 處理圖片顯示
    const imageUrl = recipe.圖片URL || CONFIG.DEFAULT_IMAGE;

    return `
    <div class="record-card" data-id="${recipe.ID || ''}">
      <div class="record-header">
        <h3>${recipe.料理名稱 || '未命名料理'}</h3>
        <span class="record-date">${formatDate(recipe.烹飪日期)}</span>
      </div>
      
      <div class="recipe-image">
        <img src="${imageUrl}" alt="${recipe.料理名稱 || ''}">
      </div>
      
      <div class="recipe-ratings">
        <div>美味度: ${renderStars(tasteRating)}</div>
        <div>難易度: ${renderStars(difficultyRating)}</div>
      </div>
      
      <div class="recipe-ingredients">
        <h4>食材:</h4>
        <p>${ingredients}</p>
      </div>
      
      <div class="recipe-steps">
        <h4>步驟:</h4>
        <p>${formatSteps(recipe.步驟)}</p>
      </div>
      
      <div class="recipe-notes">
        <h4>備註:</h4>
        <p>${recipe.備註 || '無備註'}</p>
      </div>
      
      <div class="recipe-actions">
        <button class="btn-edit">✏️ 編輯</button>
        <button class="btn-delete" data-id="${recipe.ID}">🗑️ 刪除</button>
      </div>
    </div>
    `;
  }).join('');
}

function renderStars(count, activeChar = '⭐', inactiveChar = '☆') {
  return activeChar.repeat(count) + inactiveChar.repeat(CONFIG.MAX_RATING - count);
}

function formatDate(dateString) {
  if (!dateString) return '無日期';
  
  try {
    // 處理 ISO 格式 (YYYY-MM-DD)
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-');
      return `${year}-${month}-${day}`; // 或改用 toLocaleDateString()
    }
    
    // 處理其他格式
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    
  } catch (e) {
    console.warn('日期解析失敗:', dateString);
    return '無日期';
  }
}

function updateRecordsCount(count) {
  const countElement = document.getElementById('records-count');
  if (countElement) {
    countElement.textContent = `${count} 個記錄`;
  }
}

async function loadRecipeForEditing(recipeId) {
  try {
    // === 1. 強化 ID 驗證 ===
    console.log('[Debug] 傳入的 recipeId:', recipeId, '類型:', typeof recipeId);
    
    if (recipeId === undefined || recipeId === null || recipeId === '') {
      throw new Error('食譜ID為空');
    }

    const id = Number(recipeId);
    if (isNaN(id) || id <= 0) {
      throw new Error(`無效的食譜ID格式: ${recipeId}`);
    }

    // === 2. 顯示加載狀態 ===
    showMessage('正在載入食譜...', 'info');
    document.getElementById('loading').style.display = 'flex';

    // === 3. 發送請求 ===
    const response = await fetch(`${CONFIG.API_URL}?action=getOne&id=${id}`);
    console.log('[Debug] 後端響應狀態:', response.status);

    if (!response.ok) {
      throw new Error(`後端請求失敗: HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[Debug] 後端返回數據:', result);

    if (result.status !== 'success' || !result.data) {
      throw new Error(result.message || '後端返回數據無效');
    }

    // === 4. 填充表單 ===
    populateForm(result.data);
    document.getElementById('recipe-form').scrollIntoView({ behavior: 'smooth' });
    showMessage(`已載入: ${result.data.料理名稱}`, 'success');

  } catch (error) {
    console.error('[Error] 載入食譜失敗:', error);
    showMessage(`載入失敗: ${error.message}`, 'error');
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

async function loadRecipes() {
  try {
    showMessage('正在載入食譜...', 'info');
    document.getElementById('loading').style.display = 'flex';
    
    const response = await fetch(`${CONFIG.API_URL}?action=getAll&_=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`網路請求失敗: ${response.status}`);
    }
    
    const result = await response.json();
    
    // 驗證數據結構
    if (!result || !Array.isArray(result.data)) {
      throw new Error('無效的數據結構');
    }
    
    // 標準化數據
    const normalizedData = result.data.map(item => ({
      ...item,
      步驟: typeof item.步驟 === 'string' ? item.步驟 : 
          item.步驟 ? String(item.步驟) : '無步驟說明',
      // 其他字段標準化保持不變...
    }));

    // 臨時補全缺失欄位
    const fixedData = result.data.map(item => ({
      料理名稱: item.料理名稱 || `食譜 ${item.ID}`,
      烹飪日期: item.烹飪日期 || new Date().toISOString().split('T')[0],
      食材: item.食材 || '',
      步驟: item.步驟 || '',
      ...item // 保留原始數據
    }));
    
    renderRecipes(normalizedData);
    updateRecordsCount(normalizedData.length);
    
  } catch (error) {
    console.error('載入食譜失敗:', error);
    showMessage(`載入失敗: ${error.message}`, 'error');
    renderRecipes([]);
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

async function deleteRecipe(recipeId) {
  if (!confirm('確定要永久刪除此食譜嗎？')) return;

  try {
    showMessage('正在刪除食譜...', 'info');
    
    // 確保 ID 是數字
    const id = Number(recipeId);
    if (isNaN(id)) throw new Error('無效的食譜ID格式');

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'delete',
        ID: id.toString() // 確保傳遞字符串
      })
    });

    const result = await response.json();
    if (result.status !== 'success') {
      throw new Error(result.message || '刪除失敗');
    }
    
    showMessage('食譜已刪除', 'success');
    await loadRecipes(); // 刷新列表
    
  } catch (error) {
    console.error('刪除食譜失敗:', error);
    showMessage(`刪除失敗: ${error.message}`, 'error');
  }
}

async function searchRecipes(keyword) {
  if (!keyword.trim()) {
    await loadRecipes();
    return;
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}?action=getAll&search=${encodeURIComponent(keyword)}`);
    const result = await response.json();
    
    if (result.status === 'success') {
      renderRecipes(result.data || []);
      updateRecordsCount(result.data.length);
      showMessage(`找到 ${result.data.length} 個匹配結果`, 'success', 2000);
    } else {
      throw new Error(result.message || '搜尋失敗');
    }
  } catch (error) {
    console.error('搜尋失敗:', error);
    showMessage(`搜尋失敗: ${error.message}`, 'error');
  }
}

function resetForm() {
  document.getElementById('recipe-form').reset();
  document.getElementById('recipe-id').value = '';
  
  document.getElementById('taste-rating-value').value = '0';
  document.getElementById('difficulty-rating-value').value = '0';
  updateStarsDisplay(document.querySelectorAll('#taste-rating .star'), 0);
  updateStarsDisplay(document.querySelectorAll('#difficulty-rating .star'), 0);
  
  document.querySelector('.form-submit-btn').textContent = '✏️ 新增食譜';
  document.getElementById('cancel-edit').style.display = 'none';
  
  showMessage('表單已重置', 'info', 2000);
}

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