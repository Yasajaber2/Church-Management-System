'use client'

export const dynamic = 'force-dynamic'




import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContextSimple'
import { useRouter } from 'next/navigation'
import { classesAPI, statisticsAPI, attendanceAPI } from '@/services/api'

interface ConsecutiveChild {
  name: string
  consecutiveWeeks: number
  childId: string
}

interface ClassData {
  className: string
  classId: string
  children: ConsecutiveChild[]
}

interface ClassOption {
  _id: string
  name: string
  stage: string
  grade: string
}

interface WeeklyAttendance {
  date: string
  totalChildren: number
  presentCount: number
  attendanceRate: number
}

export default function ConsecutiveAttendancePage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  const [classesData, setClassesData] = useState<ClassData[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [weeklyData, setWeeklyData] = useState<WeeklyAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deliveryLoading, setDeliveryLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    
    if (isAuthenticated && user) {
      // مدرسي الفصول، أمين الخدمة والأدمن يمكنهم الوصول لهذه الصفحة
      if (user.role !== 'admin' && user.role !== 'serviceLeader' && user.role !== 'classTeacher' && user.role !== 'servant') {
        router.push('/statistics')
        return
      }
      
      initializePage()
    }
  }, [isAuthenticated, isLoading, router, user])

  const initializePage = async () => {
    await Promise.all([
      fetchClasses(),
      fetchConsecutiveAttendance()
    ])
  }

  const fetchClasses = async () => {
    try {
      const response = await classesAPI.getAll()
      if (response.success && response.data) {
        setClasses(response.data)
      }
    } catch (error) {
      console.error('Error fetching classes:', error)
    }
  }

  const fetchConsecutiveAttendance = async (classId?: string) => {
    try {
      setLoading(true)
      setError('')
      
      const data = await statisticsAPI.getConsecutiveAttendanceByClasses(classId)
      console.log('📊 API Response:', data)
      
      if (data.success) {
        setClassesData(data.data || [])
        console.log('✅ Classes data set:', data.data?.length || 0, 'classes')
        await fetchWeeklyData(classId)
      } else {
        setError(data.error || 'حدث خطأ في جلب البيانات')
        console.error('❌ API Error:', data.error)
      }
    } catch (error: any) {
      console.error('❌ Error fetching consecutive attendance:', error)
      setError(error.message || 'حدث خطأ في جلب البيانات')
    } finally {
      setLoading(false)
    }
  }

  const fetchWeeklyData = async (classId?: string) => {
    try {
      const last4Fridays = getLastFridays(4)
      const weeklyStats: WeeklyAttendance[] = []

      for (const friday of last4Fridays) {
        const result = await attendanceAPI.getChildrenWithStatus(friday, classId)
        
        if (result.success && result.data) {
          const children = result.data
          const totalChildren = children.length
          const presentCount = children.filter((child: any) => child.attendance?.status === 'present').length
          const attendanceRate = totalChildren > 0 ? (presentCount / totalChildren) * 100 : 0
          
          weeklyStats.push({
            date: friday,
            totalChildren,
            presentCount,
            attendanceRate
          })
        }
      }

      setWeeklyData(weeklyStats.reverse()) // عرض من الأقدم للأحدث
    } catch (error) {
      console.error('Error fetching weekly data:', error)
    }
  }

  const getLastFridays = (count: number) => {
    const fridays = []
    const today = new Date()
    let current = new Date(today)
    
    // البحث عن آخر جمعة
    while (current.getDay() !== 5) {
      current.setDate(current.getDate() - 1)
    }
    
    // الحصول على آخر 'count' جمعات
    for (let i = 0; i < count; i++) {
      fridays.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() - 7)
    }
    
    return fridays.reverse()
  }

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId)
    fetchConsecutiveAttendance(classId)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-EG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getTotalChildren = () => {
    return classesData.reduce((total, classData) => total + classData.children.length, 0)
  }

  const getAllChildren = () => {
    return classesData.flatMap(classData => classData.children)
  }

  const handleDeliverGift = async (childId: string, childName: string) => {
    try {
      setDeliveryLoading(childId)
      
      const data = await statisticsAPI.deliverGift(childId)
      
      if (data.success) {
        // Show success message
        alert(`🎁 ${data.message}`)
        
        // Refresh the data to show updated consecutive attendance
        await fetchConsecutiveAttendance(selectedClass)
      } else {
        alert(`❌ خطأ: ${data.error}`)
      }
    } catch (error: any) {
      console.error('Error delivering gift:', error)
      alert(`❌ حدث خطأ في تسليم الهدية: ${error.message}`)
    } finally {
      setDeliveryLoading(null)
    }
  }

  if (loading && classesData.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        <div className="ml-4 text-gray-600">جاري تحميل بيانات المواظبة...</div>
      </div>
    )
  }

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 text-right">
          {user?.role === 'classTeacher' || user?.role === 'servant' ? 
            `المواظبون في فصلي (4 أسابيع متتالية)` : 
            'المواظبون على الحضور (4 أسابيع متتالية)'
          }
        </h1>
        <p className="text-gray-600 text-right mt-2">
          {user?.role === 'classTeacher' || user?.role === 'servant' ? 
            'تقرير الأطفال المواظبين في فصلك لمدة 4 أسابيع متتالية أو أكثر' :
            'تقرير الأطفال المواظبين على الحضور لمدة 4 أسابيع متتالية أو أكثر مقسم حسب الفصول'
          }
        </p>
      </div>

      {/* تصفية الفصول - فقط للأدمن وأمين الخدمة */}
      {(user?.role === 'admin' || user?.role === 'serviceLeader') && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                اختر الفصل
              </label>
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-right w-full"
                title="اختر الفصل"
              >
                <option value="">جميع الفصول</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => fetchConsecutiveAttendance(selectedClass)}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-full"
              >
                {loading ? 'جاري التحديث...' : 'تحديث البيانات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* زر تحديث للمدرسين */}
      {(user?.role === 'classTeacher' || user?.role === 'servant') && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <div className="text-center">
            <button
              onClick={() => fetchConsecutiveAttendance()}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-lg"
            >
              {loading ? 'جاري تحديث بيانات الفصل...' : '🔄 تحديث بيانات المواظبين في فصلي'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-right">
          <strong>خطأ:</strong> {error}
          <button 
            onClick={() => setError('')}
            className="float-left text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">🏆</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{getTotalChildren()}</div>
            <div className="text-sm text-gray-600">طفل مواظب</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">📊</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {(() => {
                const allChildren = getAllChildren()
                return allChildren.length > 0 ? 
                  (allChildren.reduce((sum, child) => sum + child.consecutiveWeeks, 0) / allChildren.length).toFixed(1) : 
                  '0'
              })()}
            </div>
            <div className="text-sm text-gray-600">متوسط أسابيع المواظبة</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">⭐</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {(() => {
                const allChildren = getAllChildren()
                return allChildren.length > 0 ? Math.max(...allChildren.map(child => child.consecutiveWeeks)) : 0
              })()}
            </div>
            <div className="text-sm text-gray-600">أعلى عدد أسابيع</div>
          </div>
        </div>
      </div>

      {/* الرسم البياني للحضور الأسبوعي */}
      {weeklyData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 text-right">الحضور الأسبوعي (آخر 4 جمعات)</h2>
          <div className="grid grid-cols-4 gap-4">
            {weeklyData.map((week, index) => (
              <div key={index} className="text-center">
                <div className="bg-blue-100 p-4 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">{week.attendanceRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">{formatDate(week.date)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {week.presentCount} / {week.totalChildren}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* البيانات مقسمة حسب الفصول */}
      {classesData.length > 0 ? (
        <div className="space-y-8">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
            <div className="text-blue-800 text-center">
              <strong>🎉 تم العثور على {classesData.length} فصول بها أطفال مواظبين!</strong>
            </div>
          </div>
          
          {classesData.map((classData) => (
            <div key={classData.classId} className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    📚 {user?.role === 'classTeacher' || user?.role === 'servant' ? 
                        `فصلي: ${classData.className}` : 
                        `فصل ${classData.className}`
                    }
                  </h2>
                  <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2">
                    <span className="text-lg font-bold">{classData.children.length} طفل مواظب</span>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          الترتيب
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          اسم الطفل
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          عدد أسابيع المواظبة
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          التقدير
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          تسليم الهدية
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {classData.children.map((child, index) => (
                        <tr key={child.childId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end">
                              {index === 0 && (
                                <span className="text-yellow-500 text-lg mr-2">🥇</span>
                              )}
                              {index === 1 && (
                                <span className="text-gray-400 text-lg mr-2">🥈</span>
                              )}
                              {index === 2 && (
                                <span className="text-yellow-600 text-lg mr-2">🥉</span>
                              )}
                              <span className="text-sm font-medium text-gray-900">
                                {index + 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {child.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end">
                              <div className="text-sm font-medium text-gray-900 mr-2">
                                {child.consecutiveWeeks} أسبوع
                              </div>
                              <div className="w-12 h-2 bg-gray-200 rounded-full">
                                <div 
                                  className="h-2 bg-green-500 rounded-full" 
                                  style={{ width: `${Math.min((child.consecutiveWeeks / 8) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              child.consecutiveWeeks >= 8 ? 'bg-green-100 text-green-800' :
                              child.consecutiveWeeks >= 6 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {child.consecutiveWeeks >= 8 ? 'ممتاز ⭐' :
                               child.consecutiveWeeks >= 6 ? 'جيد جداً 👍' :
                               'جيد 👌'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => handleDeliverGift(child.childId, child.name)}
                              disabled={deliveryLoading === child.childId}
                              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium flex items-center gap-2"
                            >
                              {deliveryLoading === child.childId ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  جاري التسليم...
                                </>
                              ) : (
                                <>
                                  🎁 تم تسليم الهدية
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !loading ? (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-gray-500 text-xl mb-2">
            {user?.role === 'classTeacher' || user?.role === 'servant' ? 
              'لا توجد أطفال مواظبين في فصلك حالياً' :
              'لا توجد بيانات للعرض'
            }
          </div>
          <p className="text-gray-400">
            {user?.role === 'classTeacher' || user?.role === 'servant' ? 
              'لم يتم العثور على أطفال في فصلك مواظبين لمدة 4 أسابيع متتالية' :
              'لم يتم العثور على أطفال مواظبين لمدة 4 أسابيع متتالية'
            }
          </p>
          <button 
            onClick={() => fetchConsecutiveAttendance()}
            className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}
    </div>
  )
}
