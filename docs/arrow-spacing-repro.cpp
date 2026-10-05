// 复现 KWin 脚本菜单的构造方式，检查子菜单箭头是否压住文字
// 用法: repro <mode> <out.png>
#include <QApplication>
#include <QAction>
#include <QFont>
#include <QMenu>
#include <QPixmap>
#include <QStyle>
#include <QStyleFactory>
#include <QTimer>
#include <QTextStream>

int main(int argc, char **argv)
{
    QApplication app(argc, argv);

    const QString mode = argc > 1 ? QString::fromLocal8Bit(argv[1]) : QStringLiteral("kwin");
    const QString out = argc > 2 ? QString::fromLocal8Bit(argv[2]) : QStringLiteral("/tmp/menu.png");

    QTextStream(stdout) << "styles: " << QStyleFactory::keys().join(QStringLiteral(", ")) << "\n";
    if (QStyle *breeze = QStyleFactory::create(QStringLiteral("Breeze"))) {
        QApplication::setStyle(breeze);
        QTextStream(stdout) << "style set to Breeze\n";
    } else {
        QTextStream(stdout) << "Breeze style unavailable, using " << QApplication::style()->objectName() << "\n";
    }

    if (qEnvironmentVariableIsSet("DSH_FONT")) {
        QFont f = app.font();
        const QString spec = qEnvironmentVariable("DSH_FONT");
        const QString family = spec.section(QLatin1Char(','), 0, 0);
        bool ok = false;
        const double size = spec.section(QLatin1Char(','), 1, 1).toDouble(&ok);
        f.setFamily(family);
        if (ok) {
            f.setPointSizeF(size);
        }
        app.setFont(f);
        QTextStream(stdout) << "font: " << f.family() << " " << f.pointSizeF() << "\n";
    } else {
        QTextStream(stdout) << "font: " << app.font().family() << " " << app.font().pointSizeF() << "\n";
    }

    // 复刻 KWin：父菜单 = 窗口菜单；scripts 菜单 = 「扩展」；脚本返回 submenu->menuAction()
    QMenu windowMenu;
    QMenu *scripts = new QMenu(QStringLiteral("扩展"), &windowMenu);

    QString modeKey = mode;
    const bool highlighted = modeKey.startsWith(QLatin1String("hl_"));
    if (highlighted) {
        modeKey = modeKey.mid(3);
    }

    QString title = QStringLiteral("窗口尺寸");
    if (modeKey == QLatin1String("space")) {
        title = QStringLiteral("窗口尺寸 ");
    } else if (modeKey == QLatin1String("long")) {
        title = QStringLiteral("窗口尺寸（预设）");
    } else if (modeKey == QLatin1String("latin")) {
        title = QStringLiteral("Window Size");
    } else if (modeKey == QLatin1String("padding")) {
        title = QStringLiteral("窗口尺寸\u2002"); // en space
    } else if (modeKey == QLatin1String("twospace")) {
        title = QStringLiteral("窗口尺寸  ");
    } else if (modeKey == QLatin1String("nbsp")) {
        title = QStringLiteral("窗口尺寸\u00a0");
    }

    QMenu *sub = new QMenu(title, scripts);
    sub->addAction(QStringLiteral("800 × 600"));
    sub->addAction(QStringLiteral("1024 × 768"));
    sub->addAction(QStringLiteral("1280 × 720"));
    sub->addAction(QStringLiteral("1440 × 900"));
    sub->addAction(QStringLiteral("1600 × 900"));
    sub->addAction(QStringLiteral("1920 × 1080"));

    if (modeKey == QLatin1String("addmenu")) {
        scripts->addMenu(sub); // 常规 Qt 用法
    } else {
        scripts->addActions({sub->menuAction()}); // KWin 的用法 (UserActionsMenu)
    }

    // 「扩展」菜单在 KWin 里只放脚本条目；这里让它成为唯一项，和现象一致
    if (highlighted) {
        scripts->setActiveAction(sub->menuAction());
    }

    scripts->popup(QPoint(60, 60));

    QTimer::singleShot(400, [&]() {
        const QPixmap shot = scripts->grab();
        shot.save(out);
        QTextStream(stdout) << "saved " << out << " " << shot.width() << "x" << shot.height() << "\n";
        app.quit();
    });

    return app.exec();
}
