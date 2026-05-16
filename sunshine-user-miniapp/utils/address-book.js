const { attachDistanceMeta, normalizeAddressPoint } = require('./address')

const HISTORY_STORAGE_KEY = 'sunshine-address-history'
const FAVORITE_STORAGE_KEY = 'sunshine-address-favorites'
const HISTORY_LIMIT = 50
const FAVORITE_LIMIT = 50

function safeReadList(storageKey) {
  try {
    const value = wx.getStorageSync(storageKey)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function safeWriteList(storageKey, list) {
  try {
    wx.setStorageSync(storageKey, list)
  } catch (error) {
    // ignore storage write error
  }
}

function buildAddressKey(point = {}) {
  const normalized = normalizeAddressPoint(point)
  return [
    normalized.name || '',
    normalized.address || '',
    Number(normalized.latitude || 0).toFixed(6),
    Number(normalized.longitude || 0).toFixed(6)
  ].join('|')
}

function normalizeStoredPoint(point = {}, extra = {}) {
  const normalized = normalizeAddressPoint(point, extra)
  return {
    ...normalized,
    addressKey: buildAddressKey(normalized),
    searchTime: Number(point.searchTime || extra.searchTime || 0),
    favoriteTime: Number(point.favoriteTime || extra.favoriteTime || 0)
  }
}

function limitList(list = [], maxLength) {
  return list.slice(0, maxLength)
}

function isCoordinateOnlyAddress(point = {}) {
  const name = `${point.name || ''}`.trim()
  const address = `${point.address || ''}`.trim()
  return name === '地图选点' ||
    /经纬度|^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(address) ||
    /经纬度/.test(name)
}

function decorateList(list = [], referencePoint) {
  const favoriteMap = getFavoriteAddressMap()
  return list.map((item) => {
    const normalized = normalizeStoredPoint(item)
    const favoriteMeta = favoriteMap[normalized.addressKey]
    return {
      ...attachDistanceMeta(normalized, referencePoint),
      addressKey: normalized.addressKey,
      searchTime: normalized.searchTime,
      favoriteTime: favoriteMeta ? Number(favoriteMeta.favoriteTime || 0) : normalized.favoriteTime,
      favorite: Boolean(favoriteMeta)
    }
  })
}

function getFavoriteAddressMap() {
  return safeReadList(FAVORITE_STORAGE_KEY).reduce((result, item) => {
    const normalized = normalizeStoredPoint(item)
    result[normalized.addressKey] = normalized
    return result
  }, {})
}

function readHistoryList() {
  const normalizedList = safeReadList(HISTORY_STORAGE_KEY)
    .map((item) => normalizeStoredPoint(item))
  const cleanedList = normalizedList
    .filter((item) => !isCoordinateOnlyAddress(item))
    .sort((left, right) => Number(right.searchTime || 0) - Number(left.searchTime || 0))

  if (cleanedList.length !== normalizedList.length) {
    safeWriteList(HISTORY_STORAGE_KEY, cleanedList)
  }

  return cleanedList
}

function readFavoriteList() {
  return safeReadList(FAVORITE_STORAGE_KEY)
    .map((item) => normalizeStoredPoint(item))
    .sort((left, right) => Number(right.favoriteTime || 0) - Number(left.favoriteTime || 0))
}

function getHistoryAddresses(referencePoint) {
  return decorateList(readHistoryList(), referencePoint)
}

function getFavoriteAddresses(referencePoint) {
  return decorateList(readFavoriteList(), referencePoint)
}

function saveHistoryAddress(point) {
  const normalized = normalizeStoredPoint(point, {
    searchTime: Date.now()
  })
  if (isCoordinateOnlyAddress(normalized)) {
    return readHistoryList()
  }
  const historyList = readHistoryList().filter((item) => item.addressKey !== normalized.addressKey)
  const nextList = limitList([
    {
      ...normalized,
      searchTime: Date.now()
    }
  ].concat(historyList), HISTORY_LIMIT)

  safeWriteList(HISTORY_STORAGE_KEY, nextList)
  return nextList
}

function deleteHistoryAddress(addressKey) {
  const nextList = readHistoryList().filter((item) => item.addressKey !== addressKey)
  safeWriteList(HISTORY_STORAGE_KEY, nextList)
  return nextList
}

function clearHistoryAddresses() {
  safeWriteList(HISTORY_STORAGE_KEY, [])
}

function isFavoriteAddress(point) {
  const key = buildAddressKey(point)
  return Boolean(getFavoriteAddressMap()[key])
}

function toggleFavoriteAddress(point) {
  const normalized = normalizeStoredPoint(point)
  const favorites = readFavoriteList()
  const exists = favorites.some((item) => item.addressKey === normalized.addressKey)
  const nextList = exists
    ? favorites.filter((item) => item.addressKey !== normalized.addressKey)
    : limitList([
        {
          ...normalized,
          favoriteTime: Date.now()
        }
      ].concat(favorites.filter((item) => item.addressKey !== normalized.addressKey)), FAVORITE_LIMIT)

  safeWriteList(FAVORITE_STORAGE_KEY, nextList)

  return {
    favorite: !exists,
    list: nextList
  }
}

function decorateAddressList(list = [], referencePoint) {
  return decorateList(list, referencePoint)
}

module.exports = {
  buildAddressKey,
  clearHistoryAddresses,
  decorateAddressList,
  deleteHistoryAddress,
  getFavoriteAddresses,
  getHistoryAddresses,
  isFavoriteAddress,
  saveHistoryAddress,
  toggleFavoriteAddress
}
