(function () {
  'use strict';

  const STORAGE_KEY = 'room-checklist-v1';
  const floors = [2, 3, 4, 5, 6, 7, 8];
  const lanes = [1, 2, 3, 4, 5, 6, 7, 8];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  const roomList = document.getElementById('roomList');
  const floorNav = document.getElementById('floorNav');
  const locationInput = document.getElementById('location');
  const dateInput = document.getElementById('recordDate');
  const progressText = document.getElementById('progressText');
  const clearAllButton = document.getElementById('clearAll');
  const toast = document.getElementById('saveToast');
  let toastTimer;

  function todayLocal() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const activeDate = saved.date || todayLocal();
      if (saved.records && typeof saved.records === 'object') {
        return { date: activeDate, records: saved.records };
      }
      const legacyRecord = {
        location: typeof saved.location === 'string' ? saved.location : '',
        rooms: saved.rooms && typeof saved.rooms === 'object' ? saved.rooms : {}
      };
      return {
        date: activeDate,
        records: { [activeDate]: legacyRecord }
      };
    } catch (_) {
      return { date: todayLocal(), records: {} };
    }
  }

  const state = loadState();

  function ensureRecord(date) {
    if (!state.records[date]) state.records[date] = { location: '', rooms: {} };
    if (typeof state.records[date].location !== 'string') state.records[date].location = '';
    if (!state.records[date].rooms || typeof state.records[date].rooms !== 'object') state.records[date].rooms = {};
    const record = state.records[date];
    floors.forEach(function (floor) {
      letters.forEach(function (_, roomIndex) {
        const oldKey = floor + '-' + roomIndex;
        const migratedKey = roomKey(floor, 0, roomIndex);
        if (record.rooms[oldKey] && !record.rooms[migratedKey]) record.rooms[migratedKey] = record.rooms[oldKey];
        delete record.rooms[oldKey];
      });
      lanes.forEach(function (_, laneIndex) {
        letters.forEach(function (_, roomIndex) {
          const key = roomKey(floor, laneIndex, roomIndex);
          const entry = record.rooms[key];
          if (!entry || typeof entry !== 'object') {
            record.rooms[key] = { status: 'close', stars: 0, note: '', numbering: 'letters', customRoom: '' };
          } else {
            if (entry.status !== 'close' && !entry.stars) entry.status = 'close';
            if (typeof entry.customRoom !== 'string') entry.customRoom = '';
            if (!['letters', 'numbers', 'custom'].includes(entry.numbering)) entry.numbering = 'letters';
            if (entry.numbering === 'custom' && !entry.customRoom.trim()) entry.numbering = 'letters';
          }
        });
      });
    });
    return record;
  }

  function currentRecord() { return ensureRecord(state.date); }
  function roomData() { return currentRecord().rooms; }

  function roomKey(floor, laneIndex, roomIndex) {
    return floor + '-' + laneIndex + '-' + roomIndex;
  }

  function laneNumber(floor, laneIndex) {
    return String(floor) + String(laneIndex + 1).padStart(2, '0');
  }

  function letterRoom(floor, laneIndex, roomIndex) {
    return laneNumber(floor, laneIndex) + letters[roomIndex];
  }

  function numberRoom(floor, laneIndex, roomIndex) {
    return laneNumber(floor, laneIndex) + '-' + String(roomIndex + 1);
  }

  function showSaved(message) {
    clearTimeout(toastTimer);
    toast.textContent = message || '已自动保存';
    toast.classList.add('show');
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
      toast.textContent = '已自动保存';
    }, 1000);
  }

  function saveState(showToast) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (showToast) showSaved();
  }

  function selectedCount() {
    let count = 0;
    floors.forEach(function (floor) {
      lanes.forEach(function (_, laneIndex) {
        letters.forEach(function (_, roomIndex) {
          const entry = roomData()[roomKey(floor, laneIndex, roomIndex)];
          if (entry && (entry.status === 'close' || entry.stars)) count += 1;
        });
      });
    });
    return count;
  }

  function updateProgress() {
    progressText.textContent = '已记录 ' + selectedCount() + ' / ' + (floors.length * lanes.length * letters.length);
    floors.forEach(function (floor) {
      const complete = lanes.every(function (_, laneIndex) {
        return letters.every(function (_, roomIndex) {
          const entry = roomData()[roomKey(floor, laneIndex, roomIndex)];
          return entry && (entry.status === 'close' || entry.stars);
        });
      });
      const chip = floorNav.querySelector('[data-floor="' + floor + '"]');
      if (chip) chip.classList.toggle('complete', complete);
    });
  }

  function createFloorNav() {
    floors.forEach(function (floor) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'floor-chip';
      button.dataset.floor = String(floor);
      button.textContent = floor + '楼';
      button.addEventListener('click', function () {
        document.getElementById('floor-' + floor).scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      floorNav.appendChild(button);
    });
  }

  function applyRoomVisual(row, entry) {
    const useNumbers = entry.numbering === 'numbers';
    const customRoom = typeof entry.customRoom === 'string' ? entry.customRoom.trim() : '';
    const useCustom = entry.numbering === 'custom' && Boolean(customRoom);
    const letterChoice = row.querySelector('[data-numbering="letters"]');
    const numberChoice = row.querySelector('[data-numbering="numbers"]');
    const customChoice = row.querySelector('[data-numbering="custom"]');
    letterChoice.classList.toggle('struck', useNumbers || useCustom);
    numberChoice.classList.toggle('struck', !useNumbers);
    customChoice.classList.toggle('struck', Boolean(customRoom) && !useCustom);
    letterChoice.classList.toggle('selected-number', !useNumbers && !useCustom);
    numberChoice.classList.toggle('selected-number', useNumbers);
    customChoice.classList.toggle('selected-number', useCustom);
    customChoice.textContent = customRoom || '自定义';
    customChoice.title = customRoom || '输入自定义房间号';
    letterChoice.setAttribute('aria-pressed', String(!useNumbers && !useCustom));
    numberChoice.setAttribute('aria-pressed', String(useNumbers));
    customChoice.setAttribute('aria-pressed', String(useCustom));
    customChoice.setAttribute('aria-expanded', String(row.classList.contains('custom-open')));
    const customInput = row.querySelector('.custom-room-input');
    if (customInput && document.activeElement !== customInput) customInput.value = entry.customRoom || '';
    row.querySelectorAll('.status-btn').forEach(function (button) {
      button.classList.toggle('selected', button.dataset.value === entry.status);
      button.setAttribute('aria-pressed', String(button.dataset.value === entry.status));
    });
    row.querySelectorAll('.star-btn').forEach(function (button) {
      const filled = Number(button.dataset.star) <= (entry.stars || 0);
      button.classList.toggle('filled', filled);
      button.setAttribute('aria-pressed', String(Number(button.dataset.star) === entry.stars));
    });
    const noteInput = row.querySelector('.note-input');
    const noteButton = row.querySelector('.note-btn');
    if (noteInput && document.activeElement !== noteInput) noteInput.value = entry.note || '';
    if (noteButton) {
      noteButton.classList.toggle('has-note', Boolean(entry.note) || row.classList.contains('note-open'));
      noteButton.setAttribute('aria-expanded', String(row.classList.contains('note-open')));
    }
  }

  function renderCurrentRecord() {
    locationInput.value = currentRecord().location;
    document.querySelectorAll('.room-row').forEach(function (row) {
      const entry = roomData()[row.dataset.key] || { status: 'close', stars: 0 };
      row.classList.toggle('note-open', Boolean(entry.note));
      row.classList.toggle('custom-open', Boolean(entry.customRoom));
      applyRoomVisual(row, entry);
    });
    updateProgress();
  }

  function createRoomRow(floor, laneIndex, roomIndex) {
    const key = roomKey(floor, laneIndex, roomIndex);
    const row = document.createElement('div');
    row.className = 'room-row';
    row.dataset.key = key;

    const number = document.createElement('div');
    number.className = 'room-number';
    number.setAttribute('role', 'group');
    number.setAttribute('aria-label', '选择房号');
    const letterChoice = document.createElement('button');
    letterChoice.type = 'button';
    letterChoice.className = 'room-choice';
    letterChoice.dataset.numbering = 'letters';
    letterChoice.textContent = letterRoom(floor, laneIndex, roomIndex);
    const separator = document.createElement('span');
    separator.className = 'room-separator';
    separator.textContent = '/';
    const numberChoice = document.createElement('button');
    numberChoice.type = 'button';
    numberChoice.className = 'room-choice';
    numberChoice.dataset.numbering = 'numbers';
    numberChoice.textContent = numberRoom(floor, laneIndex, roomIndex);
    const customSeparator = document.createElement('span');
    customSeparator.className = 'room-separator';
    customSeparator.textContent = '/';
    const customChoice = document.createElement('button');
    customChoice.type = 'button';
    customChoice.className = 'room-choice custom-room-choice';
    customChoice.dataset.numbering = 'custom';
    customChoice.textContent = '自定义';
    letterChoice.addEventListener('click', function () {
      const current = roomData()[key] || {};
      roomData()[key] = Object.assign({}, current, { numbering: 'letters' });
      row.classList.remove('custom-open');
      applyRoomVisual(row, roomData()[key]);
      saveState(true);
    });
    numberChoice.addEventListener('click', function () {
      const current = roomData()[key] || {};
      roomData()[key] = Object.assign({}, current, { numbering: 'numbers' });
      row.classList.remove('custom-open');
      applyRoomVisual(row, roomData()[key]);
      saveState(true);
    });
    number.appendChild(letterChoice);
    number.appendChild(separator);
    number.appendChild(numberChoice);
    number.appendChild(customSeparator);
    number.appendChild(customChoice);
    row.appendChild(number);

    const controls = document.createElement('div');
    controls.className = 'room-controls';
    ['close'].forEach(function (value) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'status-btn';
      button.dataset.value = value;
      button.textContent = 'Close';
      button.setAttribute('aria-label', letterRoom(floor, laneIndex, roomIndex) + ' ' + button.textContent);
      button.addEventListener('click', function () {
        const current = roomData()[key] || {};
        roomData()[key] = Object.assign({}, current, { status: value, stars: 0 });
        applyRoomVisual(row, roomData()[key]);
        updateProgress();
        saveState(true);
      });
      controls.appendChild(button);
    });

    const stars = document.createElement('div');
    stars.className = 'stars';
    stars.setAttribute('aria-label', letterRoom(floor, laneIndex, roomIndex) + ' 星级');
    for (let star = 1; star <= 5; star += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'star-btn';
      button.dataset.star = String(star);
      button.textContent = '★';
      button.setAttribute('aria-label', star + '星');
      button.addEventListener('click', function () {
        const current = roomData()[key] || {};
        roomData()[key] = Object.assign({}, current, { status: '', stars: current.stars === star ? 0 : star });
        applyRoomVisual(row, roomData()[key]);
        updateProgress();
        saveState(true);
      });
      stars.appendChild(button);
    }
    controls.appendChild(stars);

    const noteButton = document.createElement('button');
    noteButton.type = 'button';
    noteButton.className = 'note-btn';
    noteButton.textContent = '备注';
    noteButton.setAttribute('aria-expanded', 'false');
    noteButton.setAttribute('aria-label', letterRoom(floor, laneIndex, roomIndex) + ' 备注');
    controls.appendChild(noteButton);
    row.appendChild(controls);

    const customWrap = document.createElement('div');
    customWrap.className = 'custom-room-wrap';
    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'custom-room-input';
    customInput.placeholder = '输入不规则房间号';
    customInput.autocomplete = 'off';
    customInput.setAttribute('aria-label', letterRoom(floor, laneIndex, roomIndex) + ' 自定义房间号');
    customWrap.appendChild(customInput);
    row.appendChild(customWrap);

    customChoice.addEventListener('click', function () {
      row.classList.add('custom-open');
      const current = roomData()[key] || {};
      if (current.customRoom && current.customRoom.trim()) {
        roomData()[key] = Object.assign({}, current, { numbering: 'custom' });
        applyRoomVisual(row, roomData()[key]);
        saveState(true);
      } else {
        customChoice.setAttribute('aria-expanded', 'true');
      }
      customInput.focus();
    });
    customInput.addEventListener('input', function () {
      const current = roomData()[key] || {};
      const hasValue = Boolean(customInput.value.trim());
      roomData()[key] = Object.assign({}, current, {
        customRoom: customInput.value,
        numbering: hasValue ? 'custom' : 'letters'
      });
      applyRoomVisual(row, roomData()[key]);
      saveState(false);
    });
    customInput.addEventListener('change', function () { saveState(true); });

    const noteWrap = document.createElement('div');
    noteWrap.className = 'room-note-wrap';
    const noteInput = document.createElement('textarea');
    noteInput.className = 'note-input';
    noteInput.rows = 2;
    noteInput.placeholder = '填写备注内容…';
    noteInput.setAttribute('aria-label', letterRoom(floor, laneIndex, roomIndex) + ' 备注内容');
    noteWrap.appendChild(noteInput);
    row.appendChild(noteWrap);

    noteButton.addEventListener('click', function () {
      const willOpen = !row.classList.contains('note-open');
      row.classList.toggle('note-open', willOpen);
      noteButton.classList.toggle('has-note', willOpen || Boolean(noteInput.value.trim()));
      noteButton.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) noteInput.focus();
    });
    noteInput.addEventListener('input', function () {
      const current = roomData()[key] || {};
      roomData()[key] = Object.assign({}, current, { note: noteInput.value });
      noteButton.classList.toggle('has-note', Boolean(noteInput.value.trim()));
      saveState(false);
    });
    noteInput.addEventListener('change', function () { saveState(true); });

    const initialEntry = roomData()[key] || { status: 'close', stars: 0 };
    customInput.value = initialEntry.customRoom || '';
    row.classList.toggle('custom-open', Boolean(initialEntry.customRoom));
    noteInput.value = initialEntry.note || '';
    noteButton.classList.toggle('has-note', Boolean(initialEntry.note));
    row.classList.toggle('note-open', Boolean(initialEntry.note));
    noteButton.setAttribute('aria-expanded', String(Boolean(initialEntry.note)));
    applyRoomVisual(row, initialEntry);
    return row;
  }

  function createRooms() {
    floors.forEach(function (floor) {
      const section = document.createElement('section');
      section.className = 'floor-section';
      section.id = 'floor-' + floor;
      const heading = document.createElement('h2');
      heading.className = 'floor-title';
      heading.textContent = floor + '楼';
      const card = document.createElement('div');
      card.className = 'floor-card';
      lanes.forEach(function (_, laneIndex) {
        const laneGroup = document.createElement('section');
        laneGroup.className = 'lane-group';
        const laneHeading = document.createElement('h3');
        laneHeading.className = 'lane-title';
        const laneToggle = document.createElement('button');
        laneToggle.type = 'button';
        laneToggle.className = 'lane-toggle';
        laneToggle.setAttribute('aria-expanded', 'false');
        const laneLabel = document.createElement('span');
        laneLabel.className = 'lane-label';
        laneLabel.textContent = laneNumber(floor, laneIndex) + '巷';
        const laneCount = document.createElement('span');
        laneCount.className = 'lane-count';
        laneCount.textContent = '11间';
        const laneAction = document.createElement('span');
        laneAction.className = 'lane-action';
        laneAction.textContent = '展开';
        laneToggle.appendChild(laneLabel);
        laneToggle.appendChild(laneCount);
        laneToggle.appendChild(laneAction);
        laneHeading.appendChild(laneToggle);
        const laneCard = document.createElement('div');
        laneCard.className = 'lane-card';
        laneCard.id = 'lane-' + floor + '-' + laneIndex;
        laneCard.hidden = true;
        laneToggle.setAttribute('aria-controls', laneCard.id);
        let roomsCreated = false;
        laneToggle.addEventListener('click', function () {
          const willOpen = laneCard.hidden;
          if (willOpen && !roomsCreated) {
            letters.forEach(function (_, roomIndex) {
              laneCard.appendChild(createRoomRow(floor, laneIndex, roomIndex));
            });
            roomsCreated = true;
          }
          laneCard.hidden = !willOpen;
          laneGroup.classList.toggle('open', willOpen);
          laneToggle.setAttribute('aria-expanded', String(willOpen));
          laneAction.textContent = willOpen ? '收起' : '展开';
        });
        laneGroup.appendChild(laneHeading);
        laneGroup.appendChild(laneCard);
        card.appendChild(laneGroup);
      });
      section.appendChild(heading);
      section.appendChild(card);
      roomList.appendChild(section);
    });
  }

  ensureRecord(state.date);
  locationInput.value = currentRecord().location;
  dateInput.value = state.date;
  createFloorNav();
  createRooms();
  updateProgress();
  saveState(false);

  locationInput.addEventListener('input', function () {
    currentRecord().location = locationInput.value;
    saveState(false);
  });
  locationInput.addEventListener('change', function () { saveState(true); });
  dateInput.addEventListener('change', function () {
    state.date = dateInput.value || todayLocal();
    dateInput.value = state.date;
    renderCurrentRecord();
    saveState(true);
  });
  clearAllButton.addEventListener('click', function () {
    const confirmed = window.confirm('确定要清空全部日期的所有记录吗？此操作无法撤销。');
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    state.date = todayLocal();
    state.records = {};
    ensureRecord(state.date);
    dateInput.value = state.date;
    renderCurrentRecord();
    saveState(false);
    showSaved('已清空全部数据');
  });
})();
