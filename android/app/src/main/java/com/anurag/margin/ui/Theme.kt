package com.anurag.margin.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.anurag.margin.R

@Immutable
data class Palette(
    val background: Color,
    val foreground: Color,
    val card: Color,
    val primary: Color,
    val primaryFg: Color,
    val muted: Color,
    val mutedFg: Color,
    val accent: Color,
    val accentFg: Color,
    val border: Color,
    val destructive: Color,
    val paperLine: Color,
    val dark: Boolean,
)

val LightPalette = Palette(
    background = Color(0xFFF6F2EC),
    foreground = Color(0xFF201914),
    card = Color(0xFFFEFDFA),
    primary = Color(0xFFA83825),
    primaryFg = Color(0xFFFCFAF6),
    muted = Color(0xFFEFEAE5),
    mutedFg = Color(0xFF675F59),
    accent = Color(0xFFFEE8DE),
    accentFg = Color(0xFF64281A),
    border = Color(0xFFE1DBD5),
    destructive = Color(0xFFB02A2D),
    paperLine = Color(0xFFD15D4D),
    dark = false,
)

val DarkPalette = Palette(
    background = Color(0xFF13100D),
    foreground = Color(0xFFEBE7E2),
    card = Color(0xFF1C1815),
    primary = Color(0xFFF08D6A),
    primaryFg = Color(0xFF1C110D),
    muted = Color(0xFF272320),
    mutedFg = Color(0xFFA39D97),
    accent = Color(0xFF3C241C),
    accentFg = Color(0xFFFACCB7),
    border = Color(0xFF312D29),
    destructive = Color(0xFFF7857D),
    paperLine = Color(0xFFE37F65),
    dark = true,
)

val Sans = FontFamily(
    Font(R.font.geist_regular, FontWeight.Normal),
    Font(R.font.geist_medium, FontWeight.Medium),
    Font(R.font.geist_semibold, FontWeight.SemiBold),
)

val Serif = FontFamily(
    Font(R.font.newsreader_regular, FontWeight.Normal),
    Font(R.font.newsreader_medium, FontWeight.Medium),
    Font(R.font.newsreader_italic, FontWeight.Normal, FontStyle.Italic),
)

val LocalPalette = staticCompositionLocalOf { LightPalette }

object Margin {
    val colors: Palette
        @Composable get() = LocalPalette.current
}

@Composable
fun MarginTheme(content: @Composable () -> Unit) {
    val palette = if (isSystemInDarkTheme()) DarkPalette else LightPalette
    val scheme = if (palette.dark) {
        darkColorScheme(
            primary = palette.primary,
            onPrimary = palette.primaryFg,
            background = palette.background,
            onBackground = palette.foreground,
            surface = palette.card,
            onSurface = palette.foreground,
            surfaceVariant = palette.muted,
            onSurfaceVariant = palette.mutedFg,
            surfaceContainerLow = palette.card,
            surfaceContainer = palette.card,
            surfaceContainerHigh = palette.card,
            outline = palette.border,
            outlineVariant = palette.border,
            error = palette.destructive,
            scrim = Color.Black,
        )
    } else {
        lightColorScheme(
            primary = palette.primary,
            onPrimary = palette.primaryFg,
            background = palette.background,
            onBackground = palette.foreground,
            surface = palette.card,
            onSurface = palette.foreground,
            surfaceVariant = palette.muted,
            onSurfaceVariant = palette.mutedFg,
            surfaceContainerLow = palette.card,
            surfaceContainer = palette.card,
            surfaceContainerHigh = palette.card,
            outline = palette.border,
            outlineVariant = palette.border,
            error = palette.destructive,
            scrim = Color(0xFF1E1610),
        )
    }
    val base = TextStyle(fontFamily = Sans)
    val typography = Typography(
        bodyLarge = base.copy(fontSize = 16.sp, lineHeight = 24.sp),
        bodyMedium = base.copy(fontSize = 14.sp, lineHeight = 20.sp),
        bodySmall = base.copy(fontSize = 12.sp, lineHeight = 16.sp),
        labelLarge = base.copy(fontSize = 14.sp, fontWeight = FontWeight.Medium),
        labelMedium = base.copy(fontSize = 12.sp, fontWeight = FontWeight.Medium),
        titleMedium = base.copy(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
        titleLarge = base.copy(fontSize = 20.sp, fontWeight = FontWeight.SemiBold),
    )
    CompositionLocalProvider(LocalPalette provides palette) {
        MaterialTheme(colorScheme = scheme, typography = typography, content = content)
    }
}
