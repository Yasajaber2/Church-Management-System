import axios from 'axios'
import { tr } from 'date-fns/locale'
import { EnhancedStorage } from '@/utils/storage'
import Cookies from 'js-cookie'

// Base URL for the API
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://church-management-system-b6h7.onrender.com/api'
const LOCAL_URL = process.env.NEXT_PUBLIC_API_LOCAL || 'http://localhost:5000/api'

// Use production environment check
const USE_PRODUCTION_BACKEND = process.env.NEXT_PUBLIC_USE_PRODUCTION === 'true' || process.env.NODE_ENV === 'production'

// Determine which API URL to use
export const API_BASE_URL = USE_PRODUCTION_BACKEND ? 
  (process.env.NEXT_PUBLIC_API_URL || 'https://church-management-system-b6h7.onrender.com/api') : 
  LOCAL_URL

console.log('API Base URL:', API_BASE_URL)
console.log('Environment:', process.env.NODE_ENV)

// Create axios instance with enhanced CORS settings
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds timeout (increased for heavy operations)
  headers: {
    'Content-Type': 'application/json',
  },
})

// Safe storage operations for web using enhanced storage
const safeStorage = {
  getItem: (key: string): string | null => {
    return EnhancedStorage.getItem(key)
  },
  
  setItem: (key: string, value: string): void => {
    EnhancedStorage.setItem(key, value)
  },
  
  removeItem: (key: string): void => {
    EnhancedStorage.removeItem(key)
  }
}

// Request interceptor with enhanced mobile support
api.interceptors.request.use(
  async (config) => {
    try {
      // Enhanced token retrieval using EnhancedStorage
      const token = EnhancedStorage.getAuthToken()
      
      console.log('Token from storage:', token ? 'EXISTS' : 'NOT_FOUND')
      console.log('Making request to:', (config.baseURL || '') + (config.url || ''))
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        console.log('Token added to request')
      } else {
        console.log('No token found in storage or cookies')
      }
    } catch (error) {
      console.error('Error getting token from storage:', error)
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Enhanced response interceptor for better mobile token management
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url)
    
    // Auto-clear cache for attendance marking to ensure fresh data
    if (response.config.url?.includes('/attendance') && response.config.method === 'post') {
      console.log('Auto-clearing statistics cache after attendance update')
      clearStatisticsCache()
    }
    
    return response
  },
  async (error) => {
    console.log(
      'API Error:',
      error.response?.status,
      error.config?.url,
      error.message
    )
    
    if (error.response?.status === 401) {
      console.log('📱 Token expired or invalid, clearing all storage')
      
      // Clear all possible token storage locations using EnhancedStorage
      EnhancedStorage.clearAuth()
      
      // Redirect to login if we're on the client side
      if (typeof window !== 'undefined') {
        // Add small delay to ensure cleanup is complete
        setTimeout(() => {
          window.location.href = '/login'
        }, 100)
      }
    }
    return Promise.reject(error)
  }
)

// Statistics cache management
let statisticsCache: Record<string, any> = {}

const clearStatisticsCache = () => {
  statisticsCache = {}
  console.log('Statistics cache cleared')
}

// Auth API calls
export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    try {
      console.log('🔐 محاولة تسجيل الدخول للمستخدم:', credentials.username)
      console.log('🌐 API URL:', `${API_BASE_URL}/auth/login`)
      
      const response = await api.post('/auth/login', credentials)
      console.log('✅ تم تسجيل الدخول بنجاح:', response.data)
      return response.data
    } catch (error: any) {
      console.error('❌ خطأ في تسجيل الدخول:', error)
      console.error('📝 Response data:', error.response?.data)
      console.error('📊 Response status:', error.response?.status)
      console.error('🔍 Request config:', error.config)
      throw {
        success: false,
        message: error.response?.data?.error || error.response?.data?.message || 'حدث خطأ في تسجيل الدخول',
        ...error
      }
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me')
      return response.data
    } catch (error: any) {
      console.error('Get current user error:', error)
      throw error
    }
  },

  refreshToken: async () => {
    try {
      const response = await api.post('/auth/refresh')
      return response.data
    } catch (error: any) {
      console.error('Refresh token error:', error)
      throw error
    }
  }
}

// Children API calls
export const childrenAPI = {
  getAll: async (filters = {}) => {
    try {
      console.log('Fetching all children with filters:', filters)
      const params = new URLSearchParams(filters as Record<string, string>)
      const response = await api.get(`/children?${params}`)
      console.log('Children fetched successfully:', response.data.length, 'children')
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error fetching children:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في جلب الأطفال'
      }
    }
  },

  getAllChildren: async () => {
    return await childrenAPI.getAll()
  },

  getByClass: async (classId: string) => {
    try {
      console.log('Fetching children by class:', classId)
      const response = await api.get(`/children/class/${classId}`)
      console.log('Children by class response:', response.data)
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error fetching children by class:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في جلب الأطفال'
      }
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/children/${id}`)
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error fetching child:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في جلب الطفل'
      }
    }
  },

  create: async (childData: any) => {
    try {
      console.log('Creating new child:', childData)
      const response = await api.post('/children', childData)
      console.log('Child created successfully:', response.data)
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error creating child:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في إنشاء الطفل'
      }
    }
  },

  createChild: async (childData: any) => {
    return await childrenAPI.create(childData)
  },

  update: async (id: string, childData: any) => {
    try {
      console.log('Updating child:', id, childData)
      const response = await api.put(`/children/${id}`, childData)
      console.log('Child updated successfully:', response.data)
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error updating child:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحديث الطفل'
      }
    }
  },

  updateChild: async (id: string, childData: any) => {
    return await childrenAPI.update(id, childData)
  },

  delete: async (id: string) => {
    try {
      console.log('Deleting child:', id)
      const response = await api.delete(`/children/${id}`)
      console.log('Child deleted successfully')
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error deleting child:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في حذف الطفل'
      }
    }
  },

  deleteChild: async (id: string) => {
    return await childrenAPI.delete(id)
  },

  // Get children statistics by class
  getStatisticsByClass: async () => {
    try {
      console.log('Fetching children statistics by class')
      const response = await api.get('/children/statistics/by-class')
      console.log('Children statistics by class fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching children statistics by class:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل إحصائيات الأطفال'
      }
    }
  },

  // Get individual child statistics
  getIndividualStatistics: async (childId: string) => {
    try {
      console.log('Fetching individual child statistics for:', childId)
      const response = await api.get(`/children/statistics/individual/${childId}`)
      console.log('Individual child statistics fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching individual child statistics:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل إحصائيات الطفل'
      }
    }
  }
}

// Attendance API calls
export const attendanceAPI = {
  getChildrenWithStatus: async (date: string, classId?: string) => {
    try {
      console.log('Fetching children with attendance status for date:', date, 'classId:', classId)
      const params = new URLSearchParams()
      params.append('date', date)
      if (classId) params.append('classId', classId)
      
      const response = await api.get(`/attendance/children-with-status?${params}`)
      console.log('Children with status fetched successfully:', response.data.data?.length || 0, 'children')
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error fetching children with status:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في جلب بيانات الحضور'
      }
    }
  },

  getByClass: async (classId: string, date?: string) => {
    try {
      console.log('Fetching attendance for class:', classId, 'date:', date)
      const params = new URLSearchParams()
      if (date) params.append('date', date)
      
      const response = await api.get(`/attendance/class/${classId}?${params}`)
      console.log('Attendance fetched successfully')
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error fetching attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في جلب الحضور'
      }
    }
  },

  getAttendanceByDate: async (date: string, classId?: string) => {
    try {
      console.log('Fetching attendance by date:', date, 'classId:', classId)
      const params = new URLSearchParams()
      params.append('date', date)
      if (classId) params.append('classId', classId)
      
      const response = await api.get(`/attendance/children?${params}`)
      console.log('Attendance by date fetched successfully')
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error fetching attendance by date:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في جلب الحضور'
      }
    }
  },

  markAttendance: async (attendanceData: any) => {
    try {
      console.log('Marking attendance:', attendanceData)
      const response = await api.post('/attendance', attendanceData)
      console.log('Attendance marked successfully')
      
      // Clear cache after marking attendance
      clearStatisticsCache()
      
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error marking attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تسجيل الحضور'
      }
    }
  },

  markAllPresent: async (classId: string, date: string) => {
    try {
      console.log('Marking all present for class:', classId, 'date:', date)
      const response = await api.post('/attendance/mark-all-present', {
        classId,
        date
      })
      console.log('All marked present successfully')
      
      // Clear cache after bulk attendance
      clearStatisticsCache()
      
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error marking all present:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تسجيل الحضور الجماعي'
      }
    }
  },

  updateAttendance: async (id: string, attendanceData: any) => {
    try {
      console.log('Updating attendance:', id, attendanceData)
      const response = await api.put(`/attendance/${id}`, attendanceData)
      console.log('Attendance updated successfully')
      
      // Clear cache after updating attendance
      clearStatisticsCache()
      
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error updating attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحديث الحضور'
      }
    }
  },

  deleteAttendance: async (childId: string, date?: string) => {
    try {
      console.log('Deleting attendance for child:', childId, 'date:', date)
      const url = date ? `/attendance/${childId}/${date}` : `/attendance/${childId}`
      const response = await api.delete(url)
      console.log('Attendance deleted successfully')
      
      // Clear cache after deleting attendance
      clearStatisticsCache()
      
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error deleting attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في حذف تسجيل الحضور'
      }
    }
  }
}

// Classes API calls
export const classesAPI = {
  getAll: async () => {
    try {
      console.log('Fetching all classes')
      const response = await api.get('/classes')
      console.log('Classes fetched successfully:', response.data.length, 'classes')
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error fetching classes:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في جلب الفصول'
      }
    }
  },

  getAllClasses: async () => {
    return await classesAPI.getAll()
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/classes/${id}`)
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error fetching class:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في جلب الفصل'
      }
    }
  },

  create: async (classData: any) => {
    try {
      console.log('Creating new class:', classData)
      const response = await api.post('/classes', classData)
      console.log('Class created successfully:', response.data)
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error creating class:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في إنشاء الفصل'
      }
    }
  },

  update: async (id: string, classData: any) => {
    try {
      console.log('Updating class:', id, classData)
      const response = await api.put(`/classes/${id}`, classData)
      console.log('Class updated successfully:', response.data)
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error updating class:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحديث الفصل'
      }
    }
  },

  delete: async (id: string) => {
    try {
      console.log('Deleting class:', id)
      const response = await api.delete(`/classes/${id}`)
      console.log('Class deleted successfully')
      return { success: true, data: response.data.data || response.data }
    } catch (error: any) {
      console.error('Error deleting class:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في حذف الفصل'
      }
    }
  }
}
// Note: classesAPI is already defined elsewhere in the file, we just need to ensure it has getAllClasses method

// Statistics API calls
export const statisticsAPI = {
  getOverview: async () => {
    try {
      const cacheKey = 'overview'
      if (statisticsCache[cacheKey]) {
        console.log('Returning cached overview statistics')
        return statisticsCache[cacheKey]
      }

      console.log('Fetching overview statistics')
      const response = await api.get('/statistics/overview')
      console.log('Overview statistics fetched successfully')
      
      statisticsCache[cacheKey] = response.data
      return response.data
    } catch (error: any) {
      console.error('Error fetching overview statistics:', error)
      throw error
    }
  },

  getClassStatistics: async (classId: string, period = 'month') => {
    try {
      const cacheKey = `class-${classId}-${period}`
      if (statisticsCache[cacheKey]) {
        console.log('Returning cached class statistics')
        return statisticsCache[cacheKey]
      }

      console.log('Fetching class statistics for:', classId, 'period:', period)
      const response = await api.get(`/statistics/class/${classId}?period=${period}`)
      console.log('Class statistics fetched successfully')
      
      statisticsCache[cacheKey] = response.data
      return response.data
    } catch (error: any) {
      console.error('Error fetching class statistics:', error)
      throw error
    }
  },

  getAttendanceTrends: async (period = 'month') => {
    try {
      const cacheKey = `trends-${period}`
      if (statisticsCache[cacheKey]) {
        console.log('Returning cached attendance trends')
        return statisticsCache[cacheKey]
      }

      console.log('Fetching attendance trends for period:', period)
      const response = await api.get(`/statistics/trends?period=${period}`)
      console.log('Attendance trends fetched successfully')
      
      statisticsCache[cacheKey] = response.data
      return response.data
    } catch (error: any) {
      console.error('Error fetching attendance trends:', error)
      throw error
    }
  },

  getChildStatistics: async (childId: string) => {
    try {
      const cacheKey = `child-${childId}`
      if (statisticsCache[cacheKey]) {
        console.log('Returning cached child statistics')
        return statisticsCache[cacheKey]
      }

      console.log('Fetching individual child statistics for:', childId)
      const response = await api.get(`/statistics/child/${childId}`)
      console.log('Child statistics fetched successfully')
      
      statisticsCache[cacheKey] = response.data
      return response.data
    } catch (error: any) {
      console.error('Error fetching child statistics:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل إحصائيات الطفل'
      }
    }
  },

  deliverGift: async (childId: string) => {
    try {
      console.log('Delivering gift for child:', childId)
      const response = await api.post('/statistics/deliver-gift', { childId })
      console.log('Gift delivered successfully')
      return response.data
    } catch (error: any) {
      console.error('Error delivering gift:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تسليم الهدية'
      }
    }
  },

  getConsecutiveAttendanceByClasses: async (classId?: string) => {
    try {
      const params = classId ? `?classId=${classId}` : ''
      console.log('Fetching consecutive attendance by classes')
      const response = await api.get(`/statistics/consecutive-attendance-by-classes${params}`)
      console.log('Consecutive attendance fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching consecutive attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل بيانات المواظبة'
      }
    }
  }
}

// Servants/Users API calls
export const servantsAPI = {
  getAll: async () => {
    try {
      console.log('Fetching all servants')
      const response = await api.get('/servants')
      console.log('Servants fetched successfully:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Error fetching servants:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل الخدام'
      }
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/servants/${id}`)
      return response.data
    } catch (error: any) {
      console.error('Error fetching servant:', error)
      throw error
    }
  },

  create: async (userData: any) => {
    try {
      console.log('Creating new servant:', userData)
      const response = await api.post('/servants', userData)
      console.log('Servant created successfully:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Error creating servant:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في إضافة الخادم'
      }
    }
  },

  update: async (id: string, userData: any) => {
    try {
      console.log('Updating servant:', id, userData)
      const response = await api.put(`/servants/${id}`, userData)
      console.log('Servant updated successfully:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Error updating servant:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحديث الخادم'
      }
    }
  },

  delete: async (id: string) => {
    try {
      console.log('Deleting servant:', id)
      const response = await api.delete(`/servants/${id}`)
      console.log('Servant deleted successfully')
      return response.data
    } catch (error: any) {
      console.error('Error deleting servant:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في حذف الخادم'
      }
    }
  },

  // Get servants statistics by class
  getStatisticsByClass: async () => {
    try {
      console.log('Fetching servants statistics by class')
      const response = await api.get('/servants/statistics/by-class')
      console.log('Servants statistics by class fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching servants statistics by class:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل إحصائيات الخدام'
      }
    }
  },

  // Get individual servant statistics
  getIndividualStatistics: async (servantId: string) => {
    try {
      console.log('Fetching individual servant statistics for:', servantId)
      const response = await api.get(`/servants/statistics/individual/${servantId}`)
      console.log('Individual servant statistics fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching individual servant statistics:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل إحصائيات الخادم'
      }
    }
  },

  // Get servants follow-up list (servants needing follow-up)
  getFollowUpList: async () => {
    try {
      console.log('Fetching servants follow-up list')
      const response = await api.get('/servants/statistics/follow-up')
      console.log('Servants follow-up list fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching servants follow-up list:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل قائمة افتقاد الخدام'
      }
    }
  },

  // Get servants general statistics (including follow-up count)
  getGeneralStatistics: async () => {
    try {
      console.log('Fetching servants general statistics')
      const response = await api.get('/servants/statistics/general')
      console.log('Servants general statistics fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching servants general statistics:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل الإحصائيات العامة للخدام'
      }
    }
  },

  // Get individual servants statistics with follow-up info
  getIndividualStatisticsList: async () => {
    try {
      console.log('Fetching individual servants statistics list')
      const response = await api.get('/servants/statistics/individual')
      console.log('Individual servants statistics list fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching individual servants statistics list:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل إحصائيات الخدام الفردية'
      }
    }
  },

  // ==================== ATTENDANCE FUNCTIONS ====================

  // Get servants attendance by date
  getAttendanceByDate: async (date: string) => {
    try {
      console.log('Fetching servants attendance for date:', date)
      const response = await api.get(`/servants/attendance?date=${date}`)
      console.log('Servants attendance fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching servants attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل بيانات الحضور'
      }
    }
  },

  // Mark servant attendance
  markAttendance: async (attendanceData: {
    servantId: string
    date: string
    status: 'present' | 'absent'
    notes?: string
  }) => {
    try {
      console.log('Marking servant attendance:', attendanceData)
      const response = await api.post('/servants/attendance', attendanceData)
      console.log('Servant attendance marked successfully')
      return response.data
    } catch (error: any) {
      console.error('Error marking servant attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تسجيل الحضور'
      }
    }
  },

  // Delete servant attendance
  deleteAttendance: async (servantId: string, date: string) => {
    try {
      console.log('Deleting servant attendance for:', servantId, 'on date:', date)
      const response = await api.delete(`/servants-attendance/remove`, {
        data: { servantId, date }
      })
      console.log('Servant attendance deleted successfully')
      return response.data
    } catch (error: any) {
      console.error('Error deleting servant attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في مسح تسجيل الحضور'
      }
    }
  },

  // Mark all servants present for a date
  markAllPresent: async (date: string) => {
    try {
      console.log('Marking all servants present for date:', date)
      const response = await api.post('/servants/attendance/mark-all-present', { date })
      console.log('All servants marked present successfully')
      return response.data
    } catch (error: any) {
      console.error('Error marking all servants present:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تسجيل حضور جميع الخدام'
      }
    }
  },

  // Get servant attendance statistics
  getStatistics: async (servantId: string) => {
    try {
      console.log('Fetching servant attendance statistics for:', servantId)
      const response = await api.get(`/servants-attendance/statistics/${servantId}`)
      console.log('Servant attendance statistics fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching servant attendance statistics:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل إحصائيات الخادم'
      }
    }
  }
}

// Pastoral Care API calls
export const pastoralCareAPI = {
  getAll: async (filters = {}) => {
    try {
      console.log('Fetching pastoral care records with filters:', filters)
      const params = new URLSearchParams(filters as Record<string, string>)
      const response = await api.get(`/pastoral-care?${params}`)
      console.log('Pastoral care records fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching pastoral care records:', error)
      throw error
    }
  },

  create: async (recordData: any) => {
    try {
      console.log('Creating new pastoral care record:', recordData)
      const response = await api.post('/pastoral-care', recordData)
      console.log('Pastoral care record created successfully')
      return response.data
    } catch (error: any) {
      console.error('Error creating pastoral care record:', error)
      throw error
    }
  },

  update: async (id: string, recordData: any) => {
    try {
      console.log('Updating pastoral care record:', id, recordData)
      const response = await api.put(`/pastoral-care/${id}`, recordData)
      console.log('Pastoral care record updated successfully')
      return response.data
    } catch (error: any) {
      console.error('Error updating pastoral care record:', error)
      throw error
    }
  },

  delete: async (id: string) => {
    try {
      console.log('Deleting pastoral care record:', id)
      const response = await api.delete(`/pastoral-care/${id}`)
      console.log('Pastoral care record deleted successfully')
      return response.data
    } catch (error: any) {
      console.error('Error deleting pastoral care record:', error)
      throw error
    }
  },

  // الافتقاد - الحصول على الأطفال الغائبين
  getAbsentChildren: async () => {
    try {
      console.log('Fetching absent children for pastoral care')
      const response = await api.get('/pastoral-care/absent-children')
      console.log('Absent children fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching absent children:', error)
      throw error
    }
  },

  // إزالة طفل من قائمة الافتقاد (تم الاتصال به)
  removeChildFromCare: async (childId: string, reason?: string) => {
    try {
      console.log('Removing child from pastoral care:', childId)
      const response = await api.delete(`/pastoral-care/remove-child/${childId}`, {
        data: { reason }
      })
      console.log('Child removed from pastoral care successfully')
      return response.data
    } catch (error: any) {
      console.error('Error removing child from pastoral care:', error)
      throw error
    }
  },

  // تسجيل اتصال بطفل
  markChildCalled: async (childId: string, notes?: string) => {
    try {
      console.log('Marking child as called:', childId)
      const response = await api.post(`/pastoral-care/mark-called/${childId}`, {
        notes
      })
      console.log('Child marked as called successfully')
      return response.data
    } catch (error: any) {
      console.error('Error marking child as called:', error)
      throw error
    }
  }
}

// Servants Attendance API calls
export const servantsAttendanceAPI = {
  getByDate: async (date: string) => {
    try {
      console.log('Fetching servants attendance for date:', date)
      const response = await api.get(`/servants-attendance/date/${date}`)
      console.log('Servants attendance fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching servants attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل حضور الخدام'
      }
    }
  },

  create: async (attendanceData: any) => {
    try {
      console.log('Creating servant attendance:', attendanceData)
      const response = await api.post('/servants-attendance', attendanceData)
      console.log('Servant attendance created successfully')
      return response.data
    } catch (error: any) {
      console.error('Error creating servant attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تسجيل الحضور'
      }
    }
  },

  update: async (id: string, attendanceData: any) => {
    try {
      console.log('Updating servant attendance:', id, attendanceData)
      const response = await api.put(`/servants-attendance/${id}`, attendanceData)
      console.log('Servant attendance updated successfully')
      return response.data
    } catch (error: any) {
      console.error('Error updating servant attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحديث الحضور'
      }
    }
  },

  delete: async (id: string) => {
    try {
      console.log('Deleting servant attendance:', id)
      const response = await api.delete(`/servants-attendance/${id}`)
      console.log('Servant attendance deleted successfully')
      return response.data
    } catch (error: any) {
      console.error('Error deleting servant attendance:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في حذف الحضور'
      }
    }
  },

  getStatistics: async (servantId: string) => {
    try {
      console.log('Fetching servant attendance statistics for:', servantId)
      const response = await api.get(`/servants-attendance/statistics/${servantId}`)
      console.log('Servant attendance statistics fetched successfully')
      return response.data
    } catch (error: any) {
      console.error('Error fetching servant attendance statistics:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تحميل إحصائيات الحضور'
      }
    }
  },

  markAllPresent: async (date: string) => {
    try {
      console.log('Marking all servants present for date:', date)
      const response = await api.post('/servants-attendance/mark-all-present', { date })
      console.log('All servants marked present successfully')
      return response.data
    } catch (error: any) {
      console.error('Error marking all servants present:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'حدث خطأ في تسجيل الحضور الجماعي'
      }
    }
  }
}

// Export the main api instance and all APIs
export { api }
export default {
  auth: authAPI,
  children: childrenAPI,
  attendance: attendanceAPI,
  classes: classesAPI,
  statistics: statisticsAPI,
  servants: servantsAPI,
  servantsAttendance: servantsAttendanceAPI,
  pastoralCare: pastoralCareAPI,
  clearStatisticsCache
}
