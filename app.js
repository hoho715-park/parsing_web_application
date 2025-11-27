/**
 * JavaScript Code Parsing & Summary Web App
 * AST 파싱 및 코드 품질 분석
 */

// ================================
// 전역 변수
// ================================
let latestSummary = null;
let latestAST = null;

// ================================
// DOM 참조
// ================================
const dropZone = document.getElementById("dropZone");
const zipInput = document.getElementById("zipUpload");
const fileButton = document.getElementById("fileButton");
const summaryBox = document.getElementById("summaryBox");
const resultBox = document.getElementById("result");
const astJsonBox = document.getElementById("astJsonBox");
const astJsonSection = document.getElementById("astJsonSection");

// ================================
// 이벤트 리스너 설정
// ================================

/**
 * 파일 선택 버튼 클릭 시 input 클릭
 */
fileButton.addEventListener("click", (e) => {
    e.preventDefault();
    zipInput.click();
});

/**
 * Drag over 이벤트
 */
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

/**
 * Drag leave 이벤트
 */
dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

/**
 * Drop 이벤트
 */
dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) handleZipFile(file);
});

/**
 * 파일 선택 input 변경 시
 */
zipInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleZipFile(file);
});

// ================================
// ZIP 파일 처리
// ================================

/**
 * ZIP 파일을 처리하고 AST를 파싱
 * @param {File} file - ZIP 파일
 */
async function handleZipFile(file) {
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(file);

    let appJsFile = null;
    let astJsonFile = null;

    // ZIP 내부 파일 탐색
    zip.forEach((path, entry) => {
        if (path.endsWith("app.js")) appJsFile = entry;
        if (path.endsWith("ast.json")) astJsonFile = entry;
    });

    // app.js 파일 확인
    if (!appJsFile) {
        summaryBox.textContent = "❌ ZIP 안에 app.js 파일이 없습니다!";
        return;
    }

    // app.js 코드 읽기 및 파싱
    const code = await appJsFile.async("string");
    const ast = meriyah.parse(code, { module: true, next: true, loc: true });
    latestAST = ast;

    // AST 분석
    const summary = analyzeAST(ast);
    latestSummary = summary;

    // UI 업데이트
    displaySummary(appJsFile.name, summary);
    resultBox.textContent = JSON.stringify(ast, null, 2);

    // ZIP 내부 ast.json 파일 처리
    if (astJsonFile) {
        const text = await astJsonFile.async("string");
        astJsonSection.style.display = "block";
        astJsonBox.textContent = JSON.stringify(JSON.parse(text), null, 2);
    } else {
        astJsonSection.style.display = "none";
        astJsonBox.textContent = "";
    }
}

// ================================
// AST 분석 함수
// ================================

/**
 * AST 기본 분석
 * @param {Object} ast - AST 객체
 * @returns {Object} 분석 결과
 */
function analyzeAST(ast) {
    let functions = 0;
    let variables = 0;
    let eventListeners = 0;
    let lines = 0;

    /**
     * AST 노드 순회
     * @param {Object} node - AST 노드
     */
    function walk(node) {
        if (!node || typeof node !== "object") return;

        // 함수 선언 카운트
        if (node.type === "FunctionDeclaration") functions++;

        // 변수 선언 카운트
        if (node.type === "VariableDeclarator") variables++;

        // 이벤트 리스너 카운트
        if (
            node.type === "CallExpression" &&
            node.callee &&
            node.callee.property &&
            node.callee.property.name === "addEventListener"
        ) {
            eventListeners++;
        }

        // 최대 라인 수 계산
        if (node.loc) lines = Math.max(lines, node.loc.end.line);

        // 자식 노드 순회
        for (let key in node) walk(node[key]);
    }

    walk(ast);

    return { functions, variables, eventListeners, loc: lines };
}

// ================================
// 확장 메트릭 계산
// ================================

/**
 * 확장 코드 메트릭 계산 (Lite Version)
 * @param {Object} ast - AST 객체
 * @param {Object} summary - 기본 분석 결과
 * @returns {Object} 확장 메트릭
 */
function computeExtendedMetrics(ast, summary) {
    return {
        loc: summary.loc,
        cyclomatic: Math.max(1, summary.functions + summary.eventListeners),
        cbo: summary.functions,
        rfc: summary.functions + summary.variables,
        fanOut: summary.variables,
        lcom: Math.max(0, summary.functions - 1),
        tcc: 1 - summary.functions / 50,
        dit: 1,
        noc: 0,
        wmc: summary.functions * 2,
        halsteadVolume: summary.variables * 10,
        halsteadEffort: summary.variables * 30,
        maintainabilityIndex: 171 - summary.functions - summary.variables
    };
}

// ================================
// 품질 점수 계산
// ================================

/**
 * 코드 품질 점수 계산
 * @param {Object} summary - 분석 결과
 * @returns {Object} 품질 점수
 */
function calculateQualityScore(summary) {
    const maxFunc = 20;
    const maxVar = 30;

    const funcScore = Math.max(0, 100 - (summary.functions / maxFunc) * 100);
    const varScore = Math.max(0, 100 - (summary.variables / maxVar) * 100);
    const eventScore = Math.max(0, 100 - Math.abs(summary.eventListeners - 3) * 20);

    const miScore = Math.round(
        funcScore * 0.4 + varScore * 0.3 + eventScore * 0.3
    );

    return {
        funcScore: Math.round(funcScore),
        varScore: Math.round(varScore),
        eventScore: Math.round(eventScore),
        miScore,
        total: Math.round((funcScore + varScore + eventScore + miScore) / 4)
    };
}

// ================================
// UI 렌더링
// ================================

/**
 * 요약 박스 UI 렌더링
 * @param {string} fileName - 파일 이름
 * @param {Object} summary - 분석 결과
 */
function displaySummary(fileName, summary) {
    const qualityScore = calculateQualityScore(summary);
    const extended = computeExtendedMetrics(latestAST, summary);

    summaryBox.innerHTML = `
        <h3>📊 AST 요약 분석 결과</h3>
        ✔ 함수 선언: <b>${summary.functions}</b><br>
        ✔ 변수 선언: <b>${summary.variables}</b><br>
        ✔ 이벤트 핸들러: <b>${summary.eventListeners}</b><br>
        ✔ LOC: <b>${summary.loc}</b><br>
        ✔ 파일 이름: <b>${fileName}</b><br>
        ✔ 분석 시간: <b>${new Date().toLocaleTimeString()}</b><br><br>

        <div class="quality-wrapper">

            <!-- 왼쪽 패널 -->
            <div class="quality-left">
                <h3>🧪 코드 품질 지표</h3>
                • 함수 복잡도 점수: <b>${qualityScore.funcScore}</b> / 100<br>
                • 변수 관리 점수: <b>${qualityScore.varScore}</b> / 100<br>
                • 이벤트 핸들러 점수: <b>${qualityScore.eventScore}</b> / 100<br>
                • 유지보수 지수(MI 추정): <b>${qualityScore.miScore}</b> / 100<br>
                <hr>
                📘 <b>총합 코드 품질 점수: ${qualityScore.total} 점</b>
            </div>

            <!-- 오른쪽 패널 -->
            <div class="quality-right">
                <h3>📐 확장 코드 메트릭</h3>
                • LOC <span style="color:#aaa">(코드 라인 수)</span>: <b>${extended.loc}</b><br>
                • Cyclomatic Complexity <span style="color:#aaa">(분기 복잡도)</span>: <b>${extended.cyclomatic}</b><br>
                • Coupling (CBO) <span style="color:#aaa">(결합도)</span>: <b>${extended.cbo}</b><br>
                • RFC <span style="color:#aaa">(응답 메서드 수)</span>: <b>${extended.rfc}</b><br>
                • Fan-out <span style="color:#aaa">(다른 모듈로의 의존)</span>: <b>${extended.fanOut}</b><br>
                • Cohesion (LCOM) <span style="color:#aaa">(응집도 부족)</span>: <b>${extended.lcom}</b><br>
                • TCC <span style="color:#aaa">(강한 클래스 응집도)</span>: <b>${extended.tcc.toFixed(2)}</b><br>
                • DIT <span style="color:#aaa">(상속 깊이)</span>: <b>${extended.dit}</b><br>
                • NOC <span style="color:#aaa">(자식 클래스 수)</span>: <b>${extended.noc}</b><br>
                • WMC <span style="color:#aaa">(가중 메서드 수)</span>: <b>${extended.wmc}</b><br>
                • Halstead Volume <span style="color:#aaa">(할스테드 볼륨)</span>: <b>${extended.halsteadVolume}</b><br>
                • Halstead Effort <span style="color:#aaa">(할스테드 노력치)</span>: <b>${extended.halsteadEffort}</b><br>
                • Maintainability Index <span style="color:#aaa">(유지보수 지수)</span>: <b>${extended.maintainabilityIndex}</b><br>
            </div>

        </div>
    `;
}