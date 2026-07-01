package com.lynnhub.app.ui.component

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

private val StrokeColor = Color.White

/**
 * Lynx iOS 26 风格图标集
 * 统一：描边 1.6dp / round 线帽 / round 连接 / 无填充
 */
object LynxIcons {

    val Home: ImageVector by lazy {
        ImageVector.Builder(
            name = "Home",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(3f, 9f)
                lineTo(12f, 2f)
                lineTo(21f, 9f)
                verticalLineTo(20f)
                arcTo(2f, 2f, 0f, false, true, 19f, 22f)
                horizontalLineTo(5f)
                arcTo(2f, 2f, 0f, false, true, 3f, 20f)
                close()
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(9f, 22f)
                verticalLineTo(12f)
                horizontalLineTo(15f)
                verticalLineTo(22f)
            }
        }.build()
    }

    val Assistant: ImageVector by lazy {
        ImageVector.Builder(
            name = "Assistant",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(21f, 11.5f)
                arcTo(8.38f, 8.38f, 0f, false, true, 20.1f, 15.3f)
                arcTo(8.5f, 8.5f, 0f, false, true, 12.5f, 20f)
                arcTo(8.38f, 8.38f, 0f, false, true, 8.7f, 19.1f)
                lineTo(3f, 21f)
                lineTo(4.9f, 15.3f)
                arcTo(8.38f, 8.38f, 0f, false, true, 4f, 11.5f)
                arcTo(8.5f, 8.5f, 0f, false, true, 8.7f, 3.9f)
                arcTo(8.38f, 8.38f, 0f, false, true, 12.5f, 3f)
                horizontalLineTo(13f)
                arcTo(8.48f, 8.48f, 0f, false, true, 21f, 11f)
                close()
            }
        }.build()
    }

    val Tasks: ImageVector by lazy {
        ImageVector.Builder(
            name = "Tasks",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 20f)
                horizontalLineTo(21f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(16.5f, 3.5f)
                arcTo(2.121f, 2.121f, 0f, false, true, 19.5f, 6.5f)
                lineTo(7f, 19f)
                lineTo(3f, 20f)
                lineTo(4f, 16f)
                lineTo(16.5f, 3.5f)
                close()
            }
        }.build()
    }

    val Memory: ImageVector by lazy {
        ImageVector.Builder(
            name = "Memory",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 2f)
                lineTo(2f, 7f)
                lineTo(12f, 12f)
                lineTo(22f, 7f)
                lineTo(12f, 2f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(2f, 17f)
                lineTo(12f, 22f)
                lineTo(22f, 17f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(2f, 12f)
                lineTo(12f, 17f)
                lineTo(22f, 12f)
            }
        }.build()
    }

    val Settings: ImageVector by lazy {
        ImageVector.Builder(
            name = "Settings",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 15f)
                arcTo(3f, 3f, 0f, true, false, 12f, 9f)
                arcTo(3f, 3f, 0f, true, false, 12f, 15f)
                close()
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(19.4f, 15f)
                arcTo(1.65f, 1.65f, 0f, false, false, 19.73f, 16.82f)
                lineTo(19.79f, 16.88f)
                arcTo(2f, 2f, 0f, false, true, 19.79f, 19.71f)
                arcTo(2f, 2f, 0f, false, true, 16.96f, 19.71f)
                lineTo(16.9f, 19.65f)
                arcTo(1.65f, 1.65f, 0f, false, false, 15.08f, 19.32f)
                arcTo(1.65f, 1.65f, 0f, false, false, 14.08f, 20.83f)
                verticalLineTo(21f)
                arcTo(2f, 2f, 0f, false, true, 12.08f, 23f)
                arcTo(2f, 2f, 0f, false, true, 10.08f, 21f)
                verticalLineTo(20.91f)
                arcTo(1.65f, 1.65f, 0f, false, false, 9f, 19.4f)
                arcTo(1.65f, 1.65f, 0f, false, false, 7.18f, 19.73f)
                lineTo(7.12f, 19.79f)
                arcTo(2f, 2f, 0f, false, true, 4.29f, 19.79f)
                arcTo(2f, 2f, 0f, false, true, 4.29f, 16.96f)
                lineTo(4.35f, 16.9f)
                arcTo(1.65f, 1.65f, 0f, false, false, 4.68f, 15.08f)
                arcTo(1.65f, 1.65f, 0f, false, false, 3.17f, 14.08f)
                horizontalLineTo(3f)
                arcTo(2f, 2f, 0f, false, true, 1f, 12.08f)
                arcTo(2f, 2f, 0f, false, true, 3f, 10.08f)
                horizontalLineTo(3.09f)
                arcTo(1.65f, 1.65f, 0f, false, false, 4.6f, 9f)
                arcTo(1.65f, 1.65f, 0f, false, false, 4.27f, 7.18f)
                lineTo(4.21f, 7.12f)
                arcTo(2f, 2f, 0f, false, true, 4.21f, 4.29f)
                arcTo(2f, 2f, 0f, false, true, 7.04f, 4.29f)
                lineTo(7.1f, 4.35f)
                arcTo(1.65f, 1.65f, 0f, false, false, 8.92f, 4.68f)
                horizontalLineTo(9f)
                arcTo(1.65f, 1.65f, 0f, false, false, 10f, 3.17f)
                verticalLineTo(3f)
                arcTo(2f, 2f, 0f, false, true, 12f, 1f)
                arcTo(2f, 2f, 0f, false, true, 14f, 3f)
                verticalLineTo(3.09f)
                arcTo(1.65f, 1.65f, 0f, false, false, 15.08f, 4.6f)
                arcTo(1.65f, 1.65f, 0f, false, false, 16.9f, 4.27f)
                lineTo(16.96f, 4.21f)
                arcTo(2f, 2f, 0f, false, true, 19.79f, 4.21f)
                arcTo(2f, 2f, 0f, false, true, 19.79f, 7.04f)
                lineTo(19.73f, 7.1f)
                arcTo(1.65f, 1.65f, 0f, false, false, 19.4f, 8.92f)
                verticalLineTo(9f)
                arcTo(1.65f, 1.65f, 0f, false, false, 20.91f, 10f)
                horizontalLineTo(21f)
                arcTo(2f, 2f, 0f, false, true, 23f, 12f)
                arcTo(2f, 2f, 0f, false, true, 21f, 14f)
                horizontalLineTo(20.91f)
                arcTo(1.65f, 1.65f, 0f, false, false, 19.4f, 15f)
                close()
            }
        }.build()
    }

    val Add: ImageVector by lazy {
        ImageVector.Builder(
            name = "Add",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 5f)
                verticalLineTo(19f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(5f, 12f)
                horizontalLineTo(19f)
            }
        }.build()
    }

    val ChevronBack: ImageVector by lazy {
        ImageVector.Builder(
            name = "ChevronBack",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(15f, 18f)
                lineTo(9f, 12f)
                lineTo(15f, 6f)
            }
        }.build()
    }

    val Send: ImageVector by lazy {
        ImageVector.Builder(
            name = "Send",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(22f, 2f)
                lineTo(11f, 13f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(22f, 2f)
                lineTo(15f, 22f)
                lineTo(11f, 13f)
                lineTo(2f, 9f)
                lineTo(22f, 2f)
                close()
            }
        }.build()
    }

    val Mic: ImageVector by lazy {
        ImageVector.Builder(
            name = "Mic",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 1f)
                arcTo(3f, 3f, 0f, false, false, 9f, 4f)
                verticalLineTo(12f)
                arcTo(3f, 3f, 0f, false, false, 15f, 12f)
                verticalLineTo(4f)
                arcTo(3f, 3f, 0f, false, false, 12f, 1f)
                close()
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(19f, 10f)
                verticalLineTo(12f)
                arcTo(7f, 7f, 0f, false, true, 5f, 12f)
                verticalLineTo(10f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 19f)
                verticalLineTo(23f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(8f, 23f)
                horizontalLineTo(16f)
            }
        }.build()
    }

    val Search: ImageVector by lazy {
        ImageVector.Builder(
            name = "Search",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            // 放大镜镜片：完整圆形（圆心 10,10，半径 6）
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.8f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(16f, 10f)
                arcTo(6f, 6f, 0f, true, false, 4f, 10f)
                arcTo(6f, 6f, 0f, true, true, 16f, 10f)
            }
            // 放大镜手柄：右下斜线
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.8f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(15f, 15f)
                lineTo(20f, 20f)
            }
        }.build()
    }

    val Square: ImageVector by lazy {
        ImageVector.Builder(
            name = "Square",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(6f, 6f)
                horizontalLineTo(18f)
                verticalLineTo(18f)
                horizontalLineTo(6f)
                verticalLineTo(6f)
                close()
            }
        }.build()
    }

    val Phone: ImageVector by lazy {
        ImageVector.Builder(
            name = "Phone",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(22f, 16.92f)
                verticalLineTo(19.92f)
                arcTo(2f, 2f, 0f, false, true, 19.82f, 21.92f)
                arcTo(19.79f, 19.79f, 0f, false, true, 11.19f, 18.85f)
                arcTo(19.5f, 19.5f, 0f, false, true, 5.19f, 12.85f)
                arcTo(19.79f, 19.79f, 0f, false, true, 2.12f, 4.22f)
                arcTo(2f, 2f, 0f, false, true, 4.11f, 2.22f)
                horizontalLineTo(7.11f)
                arcTo(2f, 2f, 0f, false, true, 9.11f, 3.94f)
                arcTo(12.84f, 12.84f, 0f, false, false, 9.81f, 6.75f)
                arcTo(2f, 2f, 0f, false, true, 9.36f, 8.86f)
                lineTo(8.09f, 10.13f)
                arcTo(16f, 16f, 0f, false, false, 14.09f, 16.13f)
                lineTo(15.36f, 14.86f)
                arcTo(2f, 2f, 0f, false, true, 17.47f, 14.41f)
                arcTo(12.84f, 12.84f, 0f, false, false, 20.28f, 15.11f)
                arcTo(2f, 2f, 0f, false, true, 22f, 16.92f)
                close()
            }
        }.build()
    }

    val Check: ImageVector by lazy {
        ImageVector.Builder(
            name = "Check",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(20f, 6f)
                lineTo(9f, 17f)
                lineTo(4f, 12f)
            }
        }.build()
    }

    val Key: ImageVector by lazy {
        ImageVector.Builder(
            name = "Key",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(21f, 2f)
                lineTo(19f, 4f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(7.61f, 18.61f)
                arcTo(5.5f, 5.5f, 0f, true, true, 7.61f, 9.46f)
                arcTo(5.5f, 5.5f, 0f, true, true, 7.61f, 18.61f)
                close()
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(7.61f, 18.61f)
                lineTo(15.5f, 7.5f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(15.5f, 7.5f)
                lineTo(18.5f, 10.5f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(18.5f, 10.5f)
                lineTo(22f, 7f)
            }
        }.build()
    }

    val Device: ImageVector by lazy {
        ImageVector.Builder(
            name = "Device",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(2f, 6f)
                arcTo(2f, 2f, 0f, false, true, 4f, 4f)
                horizontalLineTo(20f)
                arcTo(2f, 2f, 0f, false, true, 22f, 6f)
                verticalLineTo(14f)
                arcTo(2f, 2f, 0f, false, true, 20f, 16f)
                horizontalLineTo(4f)
                arcTo(2f, 2f, 0f, false, true, 2f, 14f)
                verticalLineTo(6f)
                close()
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(8f, 20f)
                horizontalLineTo(16f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 16f)
                verticalLineTo(20f)
            }
        }.build()
    }

    val Clock: ImageVector by lazy {
        ImageVector.Builder(
            name = "Clock",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 2f)
                arcTo(10f, 10f, 0f, true, false, 12f, 22f)
                arcTo(10f, 10f, 0f, true, false, 12f, 2f)
                close()
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 6f)
                verticalLineTo(12f)
                lineTo(16f, 14f)
            }
        }.build()
    }

    val Notification: ImageVector by lazy {
        ImageVector.Builder(
            name = "Notification",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(18f, 8f)
                arcTo(6f, 6f, 0f, false, false, 6f, 8f)
                curveTo(6f, 15f, 3f, 17f, 3f, 17f)
                horizontalLineTo(21f)
                reflectiveCurveTo(18f, 15f, 18f, 8f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(13.73f, 21f)
                arcTo(2f, 2f, 0f, false, true, 10.27f, 21f)
            }
        }.build()
    }

    val Info: ImageVector by lazy {
        ImageVector.Builder(
            name = "Info",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 2f)
                arcTo(10f, 10f, 0f, true, false, 12f, 22f)
                arcTo(10f, 10f, 0f, true, false, 12f, 2f)
                close()
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 16f)
                verticalLineTo(12f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 8f)
                horizontalLineTo(12.01f)
            }
        }.build()
    }

    val Logout: ImageVector by lazy {
        ImageVector.Builder(
            name = "Logout",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(9f, 21f)
                horizontalLineTo(5f)
                arcTo(2f, 2f, 0f, false, true, 3f, 19f)
                verticalLineTo(5f)
                arcTo(2f, 2f, 0f, false, true, 5f, 3f)
                horizontalLineTo(9f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(16f, 17f)
                lineTo(21f, 12f)
                lineTo(16f, 7f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(21f, 12f)
                horizontalLineTo(9f)
            }
        }.build()
    }

    val Trash: ImageVector by lazy {
        ImageVector.Builder(
            name = "Trash",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(3f, 6f)
                horizontalLineTo(21f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(19f, 6f)
                verticalLineTo(20f)
                arcTo(2f, 2f, 0f, false, true, 17f, 22f)
                horizontalLineTo(7f)
                arcTo(2f, 2f, 0f, false, true, 5f, 20f)
                verticalLineTo(6f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(8f, 6f)
                verticalLineTo(4f)
                arcTo(2f, 2f, 0f, false, true, 10f, 2f)
                horizontalLineTo(14f)
                arcTo(2f, 2f, 0f, false, true, 16f, 4f)
                verticalLineTo(6f)
            }
        }.build()
    }

    val Person: ImageVector by lazy {
        ImageVector.Builder(
            name = "Person",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(20f, 21f)
                verticalLineTo(19f)
                arcTo(4f, 4f, 0f, false, false, 16f, 15f)
                horizontalLineTo(8f)
                arcTo(4f, 4f, 0f, false, false, 4f, 19f)
                verticalLineTo(21f)
            }
            path(
                fill = null,
                stroke = SolidColor(StrokeColor),
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 11f)
                arcTo(4f, 4f, 0f, true, false, 12f, 3f)
                arcTo(4f, 4f, 0f, true, false, 12f, 11f)
                close()
            }
        }.build()
    }
}
