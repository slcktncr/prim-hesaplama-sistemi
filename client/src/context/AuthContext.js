import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  loading: true,
  error: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      localStorage.setItem('token', action.payload.token);
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    case 'USER_LOADED':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    case 'LOGIN_FAIL':
    case 'REGISTER_FAIL':
    case 'AUTH_ERROR':
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: null
      };
    case 'CLEAR_ERRORS':
      return {
        ...state,
        error: null
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set auth token
  const setAuthToken = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Load user
  const loadUser = async () => {
    if (localStorage.token) {
      setAuthToken(localStorage.token);
      try {
        const res = await axios.get('/api/auth/me');
        dispatch({
          type: 'USER_LOADED',
          payload: res.data
        });
      } catch (error) {
        dispatch({
          type: 'AUTH_ERROR',
          payload: error.response?.data?.message || 'Kimlik doğrulama hatası'
        });
      }
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Login
  const login = async (email, password) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const res = await axios.post('/api/auth/login', { email, password });
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: res.data
      });
      
      setAuthToken(res.data.token);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Giriş hatası';
      dispatch({
        type: 'LOGIN_FAIL',
        payload: message
      });
      return { success: false, message };
    }
  };

  // Register
  const register = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const res = await axios.post('/api/auth/register', userData);
      
      // Eğer token varsa (ilk admin kullanıcı), login yap
      if (res.data.token) {
        dispatch({
          type: 'REGISTER_SUCCESS',
          payload: res.data
        });
        setAuthToken(res.data.token);
      } else {
        // Token yoksa (normal kullanıcı), sadece loading'i false yap
        dispatch({ type: 'SET_LOADING', payload: false });
      }
      
      return { 
        success: true, 
        data: res.data,
        message: res.data.message 
      };
    } catch (error) {
      const message = error.response?.data?.message || 'Kayıt hatası';
      dispatch({
        type: 'REGISTER_FAIL',
        payload: message
      });
      return { success: false, message };
    }
  };

  // Logout
  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    setAuthToken(null);
  };

  // Clear errors
  const clearErrors = () => {
    dispatch({ type: 'CLEAR_ERRORS' });
  };

  useEffect(() => {
    loadUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        loading: state.loading,
        error: state.error,
        login,
        register,
        logout,
        clearErrors,
        loadUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };
