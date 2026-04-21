import { View, Text, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { TrendingUp } from "lucide-react-native";
import { useStore } from "@/store/useStore";

export default function SplashScreen({ onFinish }) {
    const isDarkMode = useStore((state) => state.isDarkMode);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const taglineAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Logo animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();

        // Tagline animation
        setTimeout(() => {
            Animated.timing(taglineAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();
        }, 400);

        // Finish splash after 2.5 seconds
        const timer = setTimeout(() => {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start(() => {
                if (onFinish) onFinish();
            });
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    const bgColors = isDarkMode
        ? ["#0A0F1E", "#1A1F3A", "#0A0F1E"]
        : ["#0052FF", "#0066FF", "#0099FF"];

    const textColor = isDarkMode ? "#FFFFFF" : "#FFFFFF";
    const taglineColor = isDarkMode ? "#A0AEC0" : "#E0EDFF";

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient
                colors={bgColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                {/* Logo and Brand */}
                <Animated.View
                    style={{
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                        alignItems: "center",
                    }}
                >
                    {/* Icon Container */}
                    <View
                        style={{
                            width: 100,
                            height: 100,
                            borderRadius: 28,
                            backgroundColor: "rgba(255, 255, 255, 0.15)",
                            justifyContent: "center",
                            alignItems: "center",
                            marginBottom: 24,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.3,
                            shadowRadius: 20,
                        }}
                    >
                        <TrendingUp size={56} color={textColor} strokeWidth={2.5} />
                    </View>

                    {/* App Name */}
                    <Text
                        style={{
                            fontSize: 48,
                            fontWeight: "700",
                            color: textColor,
                            letterSpacing: -1,
                            marginBottom: 12,
                        }}
                    >
                        Ascent
                    </Text>
                </Animated.View>

                {/* Tagline */}
                <Animated.View
                    style={{
                        opacity: taglineAnim,
                        position: "absolute",
                        bottom: 100,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "500",
                            color: taglineColor,
                            letterSpacing: 0.5,
                        }}
                    >
                        Reputation is the new stake
                    </Text>
                </Animated.View>
            </LinearGradient>
        </View>
    );
}
