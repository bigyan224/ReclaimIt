import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSignUp, useAuth, useOAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { styles } from "@/assets/styles/auth.styles.js";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { Image } from "expo-image";
import { API_URL } from "../../config/env";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as WebBrowser from 'expo-web-browser';
import { useI18n } from "../../i18n/I18nProvider";

// Required for OAuth in Expo
WebBrowser.maybeCompleteAuthSession();

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function SignUpScreen() {

  const { isLoaded, signUp, setActive } = useSignUp();
  const { getToken, signOut } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  const { startOAuthFlow: googleAuth } = useOAuth({ strategy: 'oauth_google' });

  const getFreshBackendToken = async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = await getToken({ skipCache: true });
      if (token) return token;
      await wait(250);
    }

    return null;
  };

  const startGoogleSignIn = async () => {
    try {
      const { createdSessionId, setActive } = await googleAuth();
      
      if (createdSessionId) {
        await setActive({ session: createdSessionId });

        await wait(250);
        const token = await getFreshBackendToken();
        console.log('🔑 Got token for OAuth user, syncing to backend...');

        try {
          const response = await fetch(`${API_URL}/users`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn('User sync failed:', response.status, errorData);
            if (response.status === 403) {
              setError("Your account is banned. Access denied.");
              await signOut();
              router.replace("/sign-up");
              return;
            }
            // Continue anyway - user is authenticated in Clerk
          } else {
            console.log('✅ User synced to backend');
          }
        } catch (syncErr) {
          console.warn('User sync request failed:', syncErr);
          // Continue anyway - user is authenticated in Clerk
        }

        router.replace("/");
      }
    } catch (err) {
      console.error('OAuth error', err);
      setError(t('auth.googleSignInFailed'));
    }
  };

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle submission of sign-up form
  const onSignUpPress = async () => {
    if (!isLoaded) return;

    // Start sign-up process using email and password provided
    try {
     await signUp.create({
  emailAddress,
  password,
  unsafeMetadata: {
    fullName: fullName.trim(),
  },
});


      // Send user an email with verification code
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      // Set 'pendingVerification' to true to display second form
      // and capture OTP code
      setPendingVerification(true);
    } catch (err) {
      if (err.errors?.[0]?.code === "form_identifier_exists") {
        setError(t('auth.emailInUse'));
      } else {
        setError(t('auth.authError'));
      }
      console.log(err);
    }
  };

  // Handle submission of verification form
  const onVerifyPress = async () => {
    if (!isLoaded) return;
    setIsSubmitting(true);

    try {
      // Use the code the user provided to attempt verification
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      });

      // If verification was completed, set the session to active
      if (signUpAttempt.status === "complete") {
  await setActive({ session: signUpAttempt.createdSessionId });

  await wait(250);
  const token = await getFreshBackendToken();
  if (!token) throw new Error("No token");

  // Split name
  const name = fullName.trim();
  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.join(" ");

  // Update Clerk profile
  try {
    await signUp.update({
      firstName: firstName || "User",
      lastName: lastName || "",
    });
  } catch (e) {
    console.log("Name update skipped", e);
  }

  // 🔥 SYNC USER TO BACKEND
  try {
    const response = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: name,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('User sync failed:', response.status, errorData);
      if (response.status === 403) {
        setError("Your account is banned. Access denied.");
        await signOut();
        router.replace("/sign-up");
        return;
      }
    }
  } catch (err) {
    console.warn('User sync request failed:', err);
  }

  router.replace("/");
}
 else {
        // If the status is not complete, check why. User may need to
        // complete further steps.
        setError(t('auth.verificationIncomplete'));
        console.error(JSON.stringify(signUpAttempt, null, 2));
      }
    } catch (err) {
      setError(err.message || t('auth.verificationFailed'));
      console.error('Verification error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pendingVerification) {
    return (
      <View style={styles.verificationContainer}>
        <Text style={styles.verificationTitle}>{t('auth.verifyEmail')}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={COLORS.expense} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError("")}>
              <Ionicons name="close" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        ) : null}

        <TextInput
          style={[styles.verificationInput, error && styles.errorInput]}
          value={code}
          placeholder={t('auth.verifyCodePlaceholder')}
          placeholderTextColor="#9A8478"
          onChangeText={(code) => setCode(code)}
        />

        <TouchableOpacity onPress={onVerifyPress} style={styles.button} disabled={isSubmitting}>
          <Text style={styles.buttonText}>{isSubmitting ? t('auth.verifying') : t('auth.verify')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      enableOnAndroid={true}
      enableAutomaticScroll={true}
    >
      <View style={styles.container}>
        <Image source={require("../../assets/images/3d-traveller-character-pointing-to-empty-phone-screen-free-png.png")} style={styles.illustration} />

  <Text style={styles.title}>{t('auth.createAccount')}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={COLORS.expense} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError("")}>
              <Ionicons name="close" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        ) : null}

        <TextInput
          style={[styles.input, error && styles.errorInput]}
          autoCapitalize="none"
          value={emailAddress}
          placeholderTextColor="#9A8478"
          placeholder={t('auth.enterEmail')}
          onChangeText={(email) => setEmailAddress(email)}
        />

        <TextInput
          style={[styles.input, error && styles.errorInput]}
          value={fullName}
          placeholder={t('auth.enterFullName')}
          placeholderTextColor="#9A8478"
          onChangeText={(name) => setFullName(name)}
        />

        <TextInput
          style={[styles.input, error && styles.errorInput]}
          value={password}
          placeholder={t('auth.enterPassword')}
          placeholderTextColor="#9A8478"
          secureTextEntry={true}
          onChangeText={(password) => setPassword(password)}
        />
        <TouchableOpacity 
          style={[styles.googleButton, { backgroundColor: 'white' }]}
          onPress={startGoogleSignIn}
        >
          <Image 
            source={require('../../assets/images/google.png')} 
            style={{ width: 20, height: 20, marginRight: 10 }} 
          />
          <Text style={[styles.buttonText, { color: 'black' }]}>{t('auth.signInGoogle')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={onSignUpPress}>
          <Text style={styles.buttonText}>{t('auth.signUp')}</Text>
        </TouchableOpacity>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>{t('auth.hasAccount')}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>{t('auth.signIn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
