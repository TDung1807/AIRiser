import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  getGoogleWorkspaceAccessToken: () => Promise<string>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            const newUser: UserProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Người dùng',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL,
              createdAt: Date.now(),
              currentPhase: 'interview',
            };
            try {
              await setDoc(userRef, newUser);
            } catch (writeError) {
              console.warn("Không thể lưu profile lên Firestore (kiểm tra rules), dùng local profile tạm thời.", writeError);
            }
            setUser(newUser);
          } else {
            setUser(userSnap.data() as UserProfile);
          }
        } catch (error) {
          console.error("Lỗi khi tải dữ liệu người dùng từ Firestore:", error);
          // Fallback: Nếu Firestore lỗi (vd: chưa mở quyền), vẫn cho phép login bằng thông tin cơ bản
          setUser({
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Người dùng',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL,
            createdAt: Date.now(),
            currentPhase: 'interview',
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      setGoogleAccessToken(credential?.accessToken || null);
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      alert("Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.");
    }
  };

  const getGoogleWorkspaceAccessToken = async (): Promise<string> => {
    if (googleAccessToken) return googleAccessToken;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không lấy được quyền truy cập Google Calendar và Google Sheets.');
    }
    setGoogleAccessToken(credential.accessToken);
    return credential.accessToken;
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
      alert("Đã xảy ra lỗi khi đăng xuất. Vui lòng thử lại.");
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithGoogle, getGoogleWorkspaceAccessToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth phải được sử dụng trong AuthProvider');
  }
  return context;
};
