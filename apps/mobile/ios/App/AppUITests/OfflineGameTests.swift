import XCTest

final class OfflineGameTests: XCTestCase {
    func testBundledGameSurvivesColdStart() {
        let app = XCUIApplication(bundleIdentifier: "dev.nhachoi.app")
        app.launch()
        let resume = app.buttons["Tiếp tục ván"]
        let play = app.buttons["Chơi Cờ tỷ phú"]
        XCTAssertTrue(play.waitForExistence(timeout: 15))
        if resume.exists {
            resume.tap()
        } else {
            play.tap()
            let name = app.textFields["Tên của bạn"]
            XCTAssertTrue(name.waitForExistence(timeout: 10))
            name.tap()
            name.typeText("Thử iOS")
            let done = app.buttons["Done"]
            if done.exists { done.tap() }
            let start = app.buttons["Bắt đầu ván"]
            for _ in 0..<4 where !start.isHittable { app.swipeUp() }
            start.tap()
        }
        let board = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Xuất phát")).firstMatch
        XCTAssertTrue(board.waitForExistence(timeout: 15))
        guard board.exists else { return }
        XCTAssertTrue(app.staticTexts["Đã lưu"].waitForExistence(timeout: 15))
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(board.waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["Đã lưu"].waitForExistence(timeout: 15))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.lifetime = .keepAlways
        add(attachment)
        app.terminate()
        app.launch()
        XCTAssertTrue(resume.waitForExistence(timeout: 15))
        resume.tap()
        XCTAssertTrue(board.waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["Đã lưu"].waitForExistence(timeout: 15))
    }
}
