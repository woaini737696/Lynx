# Hilt
-keep class dagger.hilt.** { *; }
-keep class * extends dagger.hilt.android.lifecycle.HiltViewModel { *; }

# Retrofit / OkHttp
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-keepattributes Signature
-keepattributes Exceptions
-keep class kotlin.coroutines.Continuation { *; }

# Kotlinx Serialization
-keepattributes *Annotation*
-keepclassmembers class **$$serializer { *; }
-keepclassmembers class kotlinx.serialization.json.** { *; }

# Compose - 仅保留运行时反射所需的 Compose 相关类（如 Composable Lambda）
-keep class androidx.compose.runtime.** { *; }
-keep @androidx.compose.runtime.Composable class *
-keepclassmembers class * {
    @androidx.compose.runtime.Composable <methods>;
}
