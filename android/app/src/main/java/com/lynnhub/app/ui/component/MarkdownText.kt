package com.lynnhub.app.ui.component

import android.text.SpannableStringBuilder
import android.text.method.LinkMovementMethod
import android.widget.TextView
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import io.noties.markwon.Markwon
import io.noties.markwon.core.CorePlugin
import io.noties.markwon.core.MarkwonTheme
import io.noties.markwon.html.HtmlPlugin
import io.noties.markwon.syntax.Prism4jTheme
import io.noties.markwon.syntax.Prism4jThemeDarkula
import io.noties.markwon.syntax.SyntaxHighlightPlugin
import io.noties.prism4j.GrammarLocator
import io.noties.prism4j.Prism4j

/**
 * 使用 Markwon 渲染 Markdown 的 Compose 组件。
 *
 * Markwon 是 View 系统库，这里通过 [AndroidView] 桥接到原生 [TextView]。
 * 内部使用 core + html + syntax-highlight(code) 三个插件：
 * - core：基础 markdown 语法（标题、列表、粗斜体、代码块等）
 * - html：内联 HTML 渲染
 * - syntax-highlight：代码块语法高亮（基于 Prism4j）
 *
 * 颜色自动取自 MaterialTheme：正文使用 onSurface，代码使用 onSurfaceVariant/surfaceVariant，
 * 链接使用 primary。
 *
 * @param markdown 待渲染的 markdown 文本
 * @param modifier Compose 修饰符
 * @param textSize 正文字号（默认 14sp，与聊天正文一致）
 */
@Composable
fun MarkdownText(
    markdown: String,
    modifier: Modifier = Modifier,
    textSize: TextUnit = 14.sp
) {
    val context = LocalContext.current
    val onSurfaceColor = MaterialTheme.colorScheme.onSurface.toArgb()
    val onSurfaceVariantColor = MaterialTheme.colorScheme.onSurfaceVariant.toArgb()
    val primaryColor = MaterialTheme.colorScheme.primary.toArgb()
    val surfaceVariantColor = MaterialTheme.colorScheme.surfaceVariant.toArgb()

    // Markwon 实例较重，按 context 与配色缓存；配色变化（如深色模式切换）时重建。
    val markwon = remember(
        context,
        onSurfaceColor,
        onSurfaceVariantColor,
        primaryColor,
        surfaceVariantColor
    ) {
        Markwon.builder(context)
            .usePlugin(CorePlugin.create())
            .usePlugin(HtmlPlugin.create())
            .usePlugin(
                SyntaxHighlightPlugin.create(
                    Prism4j(NoOpGrammarLocator()),
                    MaterialPrism4jTheme(
                        codeTextColor = onSurfaceVariantColor,
                        codeBackgroundColor = surfaceVariantColor,
                        delegate = Prism4jThemeDarkula.create()
                    )
                )
            )
            .build()
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            TextView(ctx).apply {
                this.textSize = textSize.value
                setTextColor(onSurfaceColor)
                // 让 markdown 中的链接可点击
                movementMethod = LinkMovementMethod.getInstance()
            }
        },
        update = { textView ->
            textView.textSize = textSize.value
            textView.setTextColor(onSurfaceColor)
            // 仅在内容变化时重新解析 markdown，避免滚动等重组带来的重复渲染
            if (textView.tag != markdown) {
                textView.tag = markdown
                markwon.setMarkdown(textView, markdown)
            }
        }
    )
}

/**
 * 空的 [GrammarLocator]：不提供任何语言的 Prism4j 语法定义。
 *
 * 当 [grammar] 返回 null 时，Prism4j 不会进行 token 着色，代码块仍会以
 * [MaterialPrism4jTheme] 配置的背景/文字色正常渲染，且不会崩溃。
 *
 * 如需真正的按语言着色，可替换为包含 Prism4j 语法定义（通常由 prism4j-bundler 生成）
 * 的 Locator。
 */
private class NoOpGrammarLocator : GrammarLocator {
    override fun grammar(prism4j: Prism4j, language: String): Prism4j.Grammar? = null
    override fun languages(): Set<String> = emptySet()
}

/**
 * 基于 Material 配色的 Prism4j 主题。
 *
 * 代码块的背景色与基础文字色使用 Material 颜色（surfaceVariant / onSurfaceVariant），
 * token 级别的着色委托给 [Prism4jThemeDarkula]（在提供语法定义后生效）。
 */
private class MaterialPrism4jTheme(
    private val codeTextColor: Int,
    private val codeBackgroundColor: Int,
    private val delegate: Prism4jTheme
) : Prism4jTheme {
    override fun background(): Int = codeBackgroundColor
    override fun textColor(): Int = codeTextColor
    override fun apply(
        language: String,
        syntax: Prism4j.Syntax,
        builder: SpannableStringBuilder,
        start: Int,
        end: Int
    ) {
        delegate.apply(language, syntax, builder, start, end)
    }
}
