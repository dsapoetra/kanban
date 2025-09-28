// API Testing Guide for Kanban Application
// This file contains test scenarios for all API endpoints

const API_BASE = 'http://localhost:3000/api';

// Test Authentication
async function testAuth() {
  console.log('Testing Authentication...');
  
  // Test Registration
  const registerResponse = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    })
  });
  
  const registerData = await registerResponse.json();
  console.log('Register:', registerData);
  
  // Test Login
  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'TestPassword123!'
    })
  });
  
  const loginData = await loginResponse.json();
  console.log('Login:', loginData);
  
  return loginData.token;
}

// Test Board Management
async function testBoards(token) {
  console.log('Testing Board Management...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  // Create Board
  const createResponse = await fetch(`${API_BASE}/boards`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Test Board',
      description: 'A test board for API testing'
    })
  });
  
  const createData = await createResponse.json();
  console.log('Create Board:', createData);
  const boardId = createData.data.id;
  
  // Get Boards
  const getBoardsResponse = await fetch(`${API_BASE}/boards`, { headers });
  const getBoardsData = await getBoardsResponse.json();
  console.log('Get Boards:', getBoardsData);
  
  // Get Board Details
  const getBoardResponse = await fetch(`${API_BASE}/boards/${boardId}`, { headers });
  const getBoardData = await getBoardResponse.json();
  console.log('Get Board Details:', getBoardData);
  
  return boardId;
}

// Test Task Management
async function testTasks(token, boardId) {
  console.log('Testing Task Management...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  // Get board columns first
  const columnsResponse = await fetch(`${API_BASE}/boards/${boardId}/columns`, { headers });
  const columnsData = await columnsResponse.json();
  const columnId = columnsData.data[0].id;
  
  // Create Task
  const createTaskResponse = await fetch(`${API_BASE}/boards/${boardId}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Test Task',
      description: 'A test task for API testing',
      column_id: columnId,
      priority: 'high',
      position: 0
    })
  });
  
  const createTaskData = await createTaskResponse.json();
  console.log('Create Task:', createTaskData);
  const taskId = createTaskData.data.id;
  
  // Get Tasks
  const getTasksResponse = await fetch(`${API_BASE}/boards/${boardId}/tasks`, { headers });
  const getTasksData = await getTasksResponse.json();
  console.log('Get Tasks:', getTasksData);
  
  // Update Task
  const updateTaskResponse = await fetch(`${API_BASE}/boards/${boardId}/tasks/${taskId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      title: 'Updated Test Task',
      priority: 'urgent'
    })
  });
  
  const updateTaskData = await updateTaskResponse.json();
  console.log('Update Task:', updateTaskData);
  
  // Move Task
  const moveTaskResponse = await fetch(`${API_BASE}/boards/${boardId}/tasks/${taskId}/move`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      column_id: columnId,
      position: 1
    })
  });
  
  const moveTaskData = await moveTaskResponse.json();
  console.log('Move Task:', moveTaskData);
  
  return taskId;
}

// Test Sprint Management
async function testSprints(token, boardId, taskId) {
  console.log('Testing Sprint Management...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  // Create Sprint
  const createSprintResponse = await fetch(`${API_BASE}/boards/${boardId}/sprints`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Test Sprint',
      description: 'A test sprint for API testing',
      goal: 'Complete all test tasks'
    })
  });
  
  const createSprintData = await createSprintResponse.json();
  console.log('Create Sprint:', createSprintData);
  const sprintId = createSprintData.data.id;
  
  // Add Task to Sprint
  const addTaskResponse = await fetch(`${API_BASE}/boards/${boardId}/sprints/${sprintId}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      task_ids: [taskId]
    })
  });
  
  const addTaskData = await addTaskResponse.json();
  console.log('Add Task to Sprint:', addTaskData);
  
  // Start Sprint
  const startSprintResponse = await fetch(`${API_BASE}/boards/${boardId}/sprints/${sprintId}/start`, {
    method: 'POST',
    headers
  });
  
  const startSprintData = await startSprintResponse.json();
  console.log('Start Sprint:', startSprintData);
  
  return sprintId;
}

// Test Analytics
async function testAnalytics(token, boardId) {
  console.log('Testing Analytics...');
  
  const headers = {
    'Authorization': `Bearer ${token}`
  };
  
  // Get Board Analytics
  const analyticsResponse = await fetch(`${API_BASE}/boards/${boardId}/analytics`, { headers });
  const analyticsData = await analyticsResponse.json();
  console.log('Board Analytics:', analyticsData);
  
  // Get Velocity Analytics
  const velocityResponse = await fetch(`${API_BASE}/boards/${boardId}/analytics/velocity`, { headers });
  const velocityData = await velocityResponse.json();
  console.log('Velocity Analytics:', velocityData);
  
  // Get Backlog
  const backlogResponse = await fetch(`${API_BASE}/boards/${boardId}/backlog`, { headers });
  const backlogData = await backlogResponse.json();
  console.log('Backlog:', backlogData);
}

// Run All Tests
async function runAllTests() {
  try {
    console.log('Starting API Tests...\n');
    
    const token = await testAuth();
    console.log('\n---\n');
    
    const boardId = await testBoards(token);
    console.log('\n---\n');
    
    const taskId = await testTasks(token, boardId);
    console.log('\n---\n');
    
    const sprintId = await testSprints(token, boardId, taskId);
    console.log('\n---\n');
    
    await testAnalytics(token, boardId);
    console.log('\n---\n');
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Export for use in testing frameworks
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testAuth,
    testBoards,
    testTasks,
    testSprints,
    testAnalytics,
    runAllTests
  };
}

// Run tests if called directly
if (typeof window === 'undefined' && require.main === module) {
  runAllTests();
}
