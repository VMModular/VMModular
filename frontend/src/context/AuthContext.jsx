import { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ME, DEV_LOGIN, GOOGLE_LOGIN } from '../graphql/queries';
import client from '../graphql/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const { data, loading: queryLoading } = useQuery(GET_ME, {
    skip: !localStorage.getItem('vmcrm_token'),
    onError: () => {
      localStorage.removeItem('vmcrm_token');
      setLoading(false);
    },
  });

  const [devLoginMutation] = useMutation(DEV_LOGIN);
  const [googleLoginMutation] = useMutation(GOOGLE_LOGIN);

  useEffect(() => {
    if (!queryLoading) {
      if (data?.me) {
        setUser(data.me);
      }
      setLoading(false);
    }
  }, [data, queryLoading]);

  const login = async (email) => {
    try {
      const { data } = await devLoginMutation({ variables: { email } });
      localStorage.setItem('vmcrm_token', data.devLogin.token);
      setUser(data.devLogin.user);
      return data.devLogin.user;
    } catch (err) {
      throw err;
    }
  };

  const loginWithGoogle = async (idToken) => {
    try {
      const { data } = await googleLoginMutation({ variables: { idToken } });
      localStorage.setItem('vmcrm_token', data.googleLogin.token);
      setUser(data.googleLogin.user);
      return data.googleLogin.user;
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('vmcrm_token');
    setUser(null);
    client.clearStore();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
