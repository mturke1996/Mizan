# Capacitor / WebView — keep bridge and plugins for release minify
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin *;
    @com.getcapacitor.PluginMethod *;
}

-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
