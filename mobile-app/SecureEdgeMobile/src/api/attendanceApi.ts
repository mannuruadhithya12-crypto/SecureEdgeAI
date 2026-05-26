import { ApiClient, ApiResponse } from './apiClient';

export interface AttendanceRecord {
  userId: string;
  userName: string;
  timestamp: string;
  verificationScore: number;
}

export async function uploadAttendance(record: AttendanceRecord): Promise<ApiResponse> {
  // Release safe logging (CHANGE-20) - no raw payload logs
  console.log(`[API] Uploading attendance for user: ${record.userName}`);
  return await ApiClient.post('/attendance', record);
}

export async function fetchUsers(): Promise<ApiResponse<any[]>> {
  console.log('[API] Fetching users list');
  return await ApiClient.get('/users');
}
