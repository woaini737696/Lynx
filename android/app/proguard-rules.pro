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

# Compose
-keep class androidx.compose.** { *; }
