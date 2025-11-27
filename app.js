/**
 * JavaScript Code Parsing & Summary Web App
 * AST 파싱 및 코드 품질 분석 + 클래스 다이어그램
 * v3.0
 */

// ================================
// Mermaid 초기화
// ================================
mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        // 배경색
        primaryColor: '#2d3748',
        primaryBorderColor: '#4fd1c5',
        primaryTextColor: '#ffffff',
        
        // 보조 색상
        secondaryColor: '#4a5568',
        secondaryBorderColor: '#63b3ed',
        secondaryTextColor: '#ffffff',
        
        // 3차 색상
        tertiaryColor: '#1a202c',
        tertiaryBorderColor: '#f6ad55',
        tertiaryTextColor: '#ffffff',
        
        // 라인 색상
        lineColor: '#63b3ed',
        
        // 텍스트
        textColor: '#ffffff',
        
        // 클래스 다이어그램 전용
        classText: '#ffffff',
        
        // 노트 색상
        noteBkgColor: '#2d3748',
        noteTextColor: '#ffffff',
        noteBorderColor: '#4fd1c5',
        
        // 폰트
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '14px'
    },
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        nodeSpacing: 50,
        rankSpacing: 50,
        padding: 15
    },
    class: {
        useMaxWidth: true,
        defaultRenderer: 'dagre-wrapper'
    }
});

// ================================
// 전역 변수
// ================================
let latestSummary = null;
let latestAST = null;
let codeStructure = null;
let isDiagramView = false;

// 차트 인스턴스
let qualityGaugeChart = null;
let qualityBarChart = null;
let metricsRadarChart = null;
let complexityDoughnutChart = null;
let metricsBarChart = null;

// ================================
// DOM 참조
// ================================
const uploadScreen = document.getElementById("uploadScreen");
const loadingScreen = document.getElementById("loadingScreen");
const resultScreen = document.getElementById("resultScreen");
const dropZone = document.getElementById("dropZone");
const zipInput = document.getElementById("zipUpload");
const fileButton = document.getElementById("fileButton");
const loadingFileName = document.getElementById("loadingFileName");
const summaryBox = document.getElementById("summaryBox");
const resultBox = document.getElementById("result");
const astJsonBox = document.getElementById("astJsonBox");
const astJsonSection = document.getElementById("astJsonSection");
const newAnalysisBtn = document.getElementById("newAnalysisBtn");
const toggleViewBtn = document.getElementById("toggleViewBtn");
const chartsContainer = document.getElementById("chartsContainer");
const diagramContainer = document.getElementById("diagramContainer");

// ================================
// 화면 전환 함수
// ================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

function goToUploadScreen() {
    showScreen('uploadScreen');
    zipInput.value = '';
    isDiagramView = false;
    toggleViewBtn.textContent = '📐 다이어그램 보기';
    toggleViewBtn.classList.remove('active');
}

function goToLoadingScreen(fileName) {
    loadingFileName.textContent = fileName;
    showScreen('loadingScreen');
}

function goToResultScreen() {
    showScreen('resultScreen');
}

// ================================
// 뷰 토글 (차트 ↔ 다이어그램)
// ================================
function toggleView() {
    isDiagramView = !isDiagramView;
    
    if (isDiagramView) {
        chartsContainer.style.display = 'none';
        diagramContainer.style.display = 'flex';
        toggleViewBtn.textContent = '📊 차트 보기';
        toggleViewBtn.classList.add('active');
        renderDiagrams();
    } else {
        chartsContainer.style.display = 'flex';
        diagramContainer.style.display = 'none';
        toggleViewBtn.textContent = '📐 다이어그램 보기';
        toggleViewBtn.classList.remove('active');
    }
}

// ================================
// 이벤트 리스너
// ================================
fileButton.addEventListener("click", (e) => {
    e.preventDefault();
    zipInput.click();
});

newAnalysisBtn.addEventListener("click", () => {
    goToUploadScreen();
});

toggleViewBtn.addEventListener("click", () => {
    toggleView();
});

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) handleZipFile(file);
});

zipInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleZipFile(file);
});

// ================================
// ZIP 파일 처리
// ================================
async function handleZipFile(file) {
    goToLoadingScreen(file.name);

    const analysisStartTime = performance.now();
    const minLoadingTime = 1000;
    const startTime = Date.now();

    try {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(file);

        let appJsFile = null;
        let astJsonFile = null;

        zip.forEach((path, entry) => {
            if (path.endsWith("app.js")) appJsFile = entry;
            if (path.endsWith("ast.json")) astJsonFile = entry;
        });

        if (!appJsFile) {
            alert("❌ ZIP 안에 app.js 파일이 없습니다!");
            goToUploadScreen();
            return;
        }

        const code = await appJsFile.async("string");
        const ast = meriyah.parse(code, { module: true, next: true, loc: true });
        latestAST = ast;

        const summary = analyzeAST(ast);
        latestSummary = summary;

        // 코드 구조 추출 (클래스 다이어그램용)
        codeStructure = extractCodeStructure(ast);

        let existingAstJson = null;
        if (astJsonFile) {
            const text = await astJsonFile.async("string");
            existingAstJson = JSON.parse(text);
        }

        const analysisEndTime = performance.now();
        const analysisTime = ((analysisEndTime - analysisStartTime) / 1000).toFixed(2);

        const elapsed = Date.now() - startTime;
        if (elapsed < minLoadingTime) {
            await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsed));
        }

        displaySummary(appJsFile.name, summary, analysisTime);
        resultBox.textContent = JSON.stringify(ast, null, 2);

        if (existingAstJson) {
            astJsonSection.style.display = "flex";
            astJsonBox.textContent = JSON.stringify(existingAstJson, null, 2);
        } else {
            astJsonSection.style.display = "none";
            astJsonBox.textContent = "";
        }

        goToResultScreen();

    } catch (error) {
        console.error("파싱 오류:", error);
        alert("❌ 파일 처리 중 오류가 발생했습니다.\n" + error.message);
        goToUploadScreen();
    }
}

// ================================
// 코드 구조 추출 (클래스 다이어그램용)
// ================================
function extractCodeStructure(ast) {
    const structure = {
        classes: [],
        functions: [],
        variables: [],
        calls: [],
        imports: [],
        exports: []
    };

    function walk(node, parent = null) {
        if (!node || typeof node !== "object") return;

        // 클래스 선언
        if (node.type === "ClassDeclaration") {
            const classInfo = {
                name: node.id ? node.id.name : 'AnonymousClass',
                extends: node.superClass ? node.superClass.name : null,
                methods: [],
                properties: []
            };

            // 클래스 바디 분석
            if (node.body && node.body.body) {
                node.body.body.forEach(member => {
                    if (member.type === "MethodDefinition") {
                        classInfo.methods.push({
                            name: member.key.name || member.key.value,
                            kind: member.kind, // constructor, method, get, set
                            static: member.static
                        });
                    } else if (member.type === "PropertyDefinition") {
                        classInfo.properties.push({
                            name: member.key.name || member.key.value,
                            static: member.static
                        });
                    }
                });
            }

            structure.classes.push(classInfo);
        }

        // 함수 선언
        if (node.type === "FunctionDeclaration" && node.id) {
            const funcInfo = {
                name: node.id.name,
                params: node.params.map(p => p.name || p.left?.name || 'param'),
                calls: []
            };
            structure.functions.push(funcInfo);
        }

        // 화살표 함수 / 함수 표현식 (변수에 할당된 경우)
        if (node.type === "VariableDeclarator") {
            const varName = node.id ? node.id.name : null;
            
            if (node.init) {
                if (node.init.type === "ArrowFunctionExpression" || 
                    node.init.type === "FunctionExpression") {
                    structure.functions.push({
                        name: varName,
                        params: node.init.params.map(p => p.name || p.left?.name || 'param'),
                        calls: [],
                        isArrow: node.init.type === "ArrowFunctionExpression"
                    });
                } else {
                    structure.variables.push({
                        name: varName,
                        kind: parent?.kind || 'var'
                    });
                }
            } else {
                structure.variables.push({
                    name: varName,
                    kind: parent?.kind || 'var'
                });
            }
        }

        // 함수 호출
        if (node.type === "CallExpression") {
            let calleeName = null;
            
            if (node.callee.type === "Identifier") {
                calleeName = node.callee.name;
            } else if (node.callee.type === "MemberExpression") {
                if (node.callee.property) {
                    calleeName = node.callee.property.name || node.callee.property.value;
                }
            }

            if (calleeName) {
                structure.calls.push({
                    name: calleeName,
                    from: parent?.id?.name || 'global'
                });
            }
        }

        // Import
        if (node.type === "ImportDeclaration") {
            structure.imports.push({
                source: node.source.value,
                specifiers: node.specifiers.map(s => s.local.name)
            });
        }

        // Export
        if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
            if (node.declaration && node.declaration.id) {
                structure.exports.push(node.declaration.id.name);
            }
        }

        // 재귀 순회
        for (let key in node) {
            if (key === 'parent') continue;
            const child = node[key];
            if (Array.isArray(child)) {
                child.forEach(c => walk(c, node));
            } else {
                walk(child, node);
            }
        }
    }

    walk(ast);
    return structure;
}

// ================================
// 다이어그램 렌더링
// ================================
async function renderDiagrams() {
    if (!codeStructure) return;

    // 클래스 다이어그램 생성
    await renderClassDiagram();
    
    // 함수 호출 다이어그램 생성
    await renderCallDiagram();
    
    // 구조 요약 생성
    renderStructureSummary();
}

async function renderClassDiagram() {
    const container = document.getElementById('classDiagram');
    container.innerHTML = '';

    let mermaidCode = 'classDiagram\n';

    // 클래스가 있는 경우
    if (codeStructure.classes.length > 0) {
        codeStructure.classes.forEach(cls => {
            mermaidCode += `    class ${cls.name} {\n`;
            
            cls.properties.forEach(prop => {
                const prefix = prop.static ? '$' : '+';
                mermaidCode += `        ${prefix}${prop.name}\n`;
            });
            
            cls.methods.forEach(method => {
                const prefix = method.static ? '$' : '+';
                const suffix = method.kind === 'constructor' ? '*' : '()';
                mermaidCode += `        ${prefix}${method.name}${suffix}\n`;
            });
            
            mermaidCode += `    }\n`;

            // 상속 관계
            if (cls.extends) {
                mermaidCode += `    ${cls.extends} <|-- ${cls.name}\n`;
            }
        });
    }

    // 함수들을 "모듈"로 표현
    if (codeStructure.functions.length > 0) {
        mermaidCode += `    class Module {\n`;
        mermaidCode += `        <<Functions>>\n`;
        
        codeStructure.functions.forEach(func => {
            const params = func.params.join(', ');
            mermaidCode += `        +${func.name}(${params})\n`;
        });
        
        mermaidCode += `    }\n`;
    }

    // 변수들을 "State"로 표현
    if (codeStructure.variables.length > 0) {
        mermaidCode += `    class State {\n`;
        mermaidCode += `        <<Variables>>\n`;
        
        const varsToShow = codeStructure.variables.slice(0, 10);
        varsToShow.forEach(v => {
            mermaidCode += `        +${v.name}\n`;
        });
        
        if (codeStructure.variables.length > 10) {
            mermaidCode += `        +..${codeStructure.variables.length - 10} more..\n`;
        }
        
        mermaidCode += `    }\n`;
    }

    // 관계 설정
    if (codeStructure.functions.length > 0 && codeStructure.variables.length > 0) {
        mermaidCode += `    Module ..> State : uses\n`;
    }

    try {
        const { svg } = await mermaid.render('classDiagramSvg', mermaidCode);
        container.innerHTML = svg;
    } catch (error) {
        console.error('Mermaid 렌더링 오류:', error);
        container.innerHTML = `<pre style="color: #ff6b6b; padding: 20px;">다이어그램 생성 오류\n\n${mermaidCode}</pre>`;
    }
}

async function renderCallDiagram() {
    const container = document.getElementById('callDiagram');
    container.innerHTML = '';

    let mermaidCode = 'flowchart TB\n';

    // 스타일 정의
    mermaidCode += '    classDef funcStyle fill:#2d3748,stroke:#4fd1c5,stroke-width:2px,color:#fff,rx:10,ry:10\n';
    mermaidCode += '    classDef eventStyle fill:#553c9a,stroke:#b794f4,stroke-width:2px,color:#fff,rx:10,ry:10\n';
    mermaidCode += '    classDef varStyle fill:#2c5282,stroke:#63b3ed,stroke-width:2px,color:#fff,rx:10,ry:10\n';

    // 고유한 함수 이름들
    const funcNames = new Set(codeStructure.functions.map(f => f.name));
    
    // 호출 관계 분석
    const callPairs = new Set();
    codeStructure.calls.forEach(call => {
        if (funcNames.has(call.name) && call.from !== 'global' && funcNames.has(call.from)) {
            callPairs.add(`${call.from}["⚡ ${call.from}"] --> ${call.name}["⚡ ${call.name}"]`);
        }
    });

    if (callPairs.size > 0) {
        callPairs.forEach(pair => {
            mermaidCode += `    ${pair}\n`;
        });
    } else if (codeStructure.functions.length > 0) {
        // 호출 관계가 없으면 함수 목록만 표시
        mermaidCode += '    subgraph Functions["📦 Functions"]\n';
        mermaidCode += '        direction LR\n';
        codeStructure.functions.slice(0, 8).forEach((func, i) => {
            mermaidCode += `        F${i}["⚡ ${func.name}"]\n`;
        });
        if (codeStructure.functions.length > 8) {
            mermaidCode += `        Fmore["... +${codeStructure.functions.length - 8} more"]\n`;
        }
        mermaidCode += '    end\n';
    }

    // 이벤트 리스너 관계
    const eventCalls = codeStructure.calls.filter(c => c.name === 'addEventListener');
    if (eventCalls.length > 0) {
        mermaidCode += '    subgraph Events["🎯 Event Listeners"]\n';
        mermaidCode += '        direction LR\n';
        mermaidCode += `        EL["${eventCalls.length} Event Listeners"]\n`;
        mermaidCode += '    end\n';
        
        if (codeStructure.functions.length > 0) {
            mermaidCode += '    Events ==> Functions\n';
        }
    }

    // 스타일 적용
    mermaidCode += '    class F0,F1,F2,F3,F4,F5,F6,F7 funcStyle\n';
    mermaidCode += '    class EL eventStyle\n';

    try {
        const { svg } = await mermaid.render('callDiagramSvg', mermaidCode);
        container.innerHTML = svg;
    } catch (error) {
        console.error('Mermaid 렌더링 오류:', error);
        container.innerHTML = `<pre style="color: #ff6b6b; padding: 20px;">다이어그램 생성 오류</pre>`;
    }
}

function renderStructureSummary() {
    const container = document.getElementById('structureSummary');
    
    let html = '';

    // 클래스 목록
    if (codeStructure.classes.length > 0) {
        html += '<h4>🏛️ 클래스 (Classes)</h4><ul>';
        codeStructure.classes.forEach(cls => {
            html += `<li class="class-item">
                <strong>${cls.name}</strong>
                ${cls.extends ? `<span style="color:#888"> extends ${cls.extends}</span>` : ''}
                <span style="color:#666"> - ${cls.methods.length} methods, ${cls.properties.length} properties</span>
            </li>`;
        });
        html += '</ul>';
    }

    // 함수 목록
    if (codeStructure.functions.length > 0) {
        html += '<h4>⚡ 함수 (Functions)</h4><ul>';
        codeStructure.functions.slice(0, 20).forEach(func => {
            const params = func.params.length > 0 ? func.params.join(', ') : '';
            html += `<li class="function-item">
                <strong>${func.name}</strong>(${params})
                ${func.isArrow ? '<span style="color:#888"> (arrow)</span>' : ''}
            </li>`;
        });
        if (codeStructure.functions.length > 20) {
            html += `<li style="color:#888">... 외 ${codeStructure.functions.length - 20}개</li>`;
        }
        html += '</ul>';
    }

    // 변수 목록
    if (codeStructure.variables.length > 0) {
        html += '<h4>📦 변수 (Variables)</h4><ul>';
        codeStructure.variables.slice(0, 15).forEach(v => {
            html += `<li class="variable-item">
                <strong>${v.name}</strong>
                <span style="color:#888"> (${v.kind})</span>
            </li>`;
        });
        if (codeStructure.variables.length > 15) {
            html += `<li style="color:#888">... 외 ${codeStructure.variables.length - 15}개</li>`;
        }
        html += '</ul>';
    }

    // Import/Export
    if (codeStructure.imports.length > 0) {
        html += '<h4>📥 Imports</h4><ul>';
        codeStructure.imports.forEach(imp => {
            html += `<li class="relation-item">from <strong>${imp.source}</strong></li>`;
        });
        html += '</ul>';
    }

    if (codeStructure.exports.length > 0) {
        html += '<h4>📤 Exports</h4><ul>';
        codeStructure.exports.forEach(exp => {
            html += `<li class="relation-item"><strong>${exp}</strong></li>`;
        });
        html += '</ul>';
    }

    container.innerHTML = html || '<p style="color:#888">분석된 구조가 없습니다.</p>';
}

// ================================
// AST 분석 함수
// ================================
function analyzeAST(ast) {
    let functions = 0;
    let variables = 0;
    let eventListeners = 0;
    let lines = 0;

    function walk(node) {
        if (!node || typeof node !== "object") return;

        if (node.type === "FunctionDeclaration") functions++;
        if (node.type === "VariableDeclarator") variables++;

        if (
            node.type === "CallExpression" &&
            node.callee &&
            node.callee.property &&
            node.callee.property.name === "addEventListener"
        ) {
            eventListeners++;
        }

        if (node.loc) lines = Math.max(lines, node.loc.end.line);

        for (let key in node) walk(node[key]);
    }

    walk(ast);

    return { functions, variables, eventListeners, loc: lines };
}

// ================================
// 확장 메트릭 계산
// ================================
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
function displaySummary(fileName, summary, analysisTime) {
    const qualityScore = calculateQualityScore(summary);
    const extended = computeExtendedMetrics(latestAST, summary);

    summaryBox.innerHTML = `
        <h3>📊 AST 요약 분석 결과</h3>
        <div class="summary-info">
            ✔ 함수 선언: <b>${summary.functions}</b> &nbsp;|&nbsp;
            ✔ 변수 선언: <b>${summary.variables}</b> &nbsp;|&nbsp;
            ✔ 이벤트 핸들러: <b>${summary.eventListeners}</b><br>
            ✔ 파일: <b>${fileName}</b> &nbsp;|&nbsp;
            ✔ 분석 소요 시간: <b>${analysisTime}초</b>
        </div>
    `;

    renderCharts(qualityScore, extended);
}

// ================================
// 차트 렌더링
// ================================
function renderCharts(qualityScore, extended) {
    destroyCharts();
    renderQualityGaugeChart(qualityScore.total);
    renderQualityBarChart(qualityScore);
    renderMetricsRadarChart(extended);
    renderComplexityDoughnutChart(extended);
    renderMetricsBarChart(extended);
}

function destroyCharts() {
    if (qualityGaugeChart) qualityGaugeChart.destroy();
    if (qualityBarChart) qualityBarChart.destroy();
    if (metricsRadarChart) metricsRadarChart.destroy();
    if (complexityDoughnutChart) complexityDoughnutChart.destroy();
    if (metricsBarChart) metricsBarChart.destroy();
}

function renderQualityGaugeChart(total) {
    const ctx = document.getElementById('qualityGaugeChart').getContext('2d');
    
    let color;
    if (total >= 80) color = '#00ff88';
    else if (total >= 60) color = '#feca57';
    else if (total >= 40) color = '#ff9f43';
    else color = '#ff6b6b';

    qualityGaugeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [total, 100 - total],
                backgroundColor: [color, '#2a2a4a'],
                borderWidth: 0,
                circumference: 270,
                rotation: 225
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw: (chart) => {
                const { ctx, width, height } = chart;
                ctx.save();
                ctx.font = 'bold 36px Segoe UI';
                ctx.fillStyle = color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(total, width / 2, height / 2);
                ctx.font = '14px Segoe UI';
                ctx.fillStyle = '#888';
                ctx.fillText('/ 100', width / 2, height / 2 + 25);
                ctx.restore();
            }
        }]
    });
}

function renderQualityBarChart(qualityScore) {
    const ctx = document.getElementById('qualityBarChart').getContext('2d');

    const labelDescriptions = {
        '함수 복잡도': '함수 복잡도 - 함수 선언 수 기반 점수',
        '변수 관리': '변수 관리 - 변수 선언 수 기반 점수',
        '이벤트 핸들러': '이벤트 핸들러 - 이벤트 리스너 수 기반 점수',
        '유지보수 지수': '유지보수 지수 - 종합 유지보수 용이성'
    };

    qualityBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['함수 복잡도', '변수 관리', '이벤트 핸들러', '유지보수 지수'],
            datasets: [{
                data: [qualityScore.funcScore, qualityScore.varScore, qualityScore.eventScore, qualityScore.miScore],
                backgroundColor: [
                    'rgba(255, 107, 107, 0.8)',
                    'rgba(254, 202, 87, 0.8)',
                    'rgba(72, 219, 251, 0.8)',
                    'rgba(255, 159, 243, 0.8)'
                ],
                borderColor: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3'],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#888' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#fff', font: { size: 11 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (context) => labelDescriptions[context[0].label] || context[0].label,
                        label: (context) => `점수: ${context.raw} / 100`
                    }
                }
            }
        }
    });
}

function renderMetricsRadarChart(extended) {
    const ctx = document.getElementById('metricsRadarChart').getContext('2d');

    const actualValues = [
        extended.loc, extended.cyclomatic, extended.cbo,
        extended.rfc, extended.fanOut, extended.wmc, extended.maintainabilityIndex
    ];

    const normalizedData = [
        Math.min(100, extended.loc / 5),
        Math.min(100, extended.cyclomatic * 10),
        Math.min(100, extended.cbo * 10),
        Math.min(100, extended.rfc * 3),
        Math.min(100, extended.fanOut * 4),
        Math.min(100, extended.wmc * 5),
        Math.min(100, extended.maintainabilityIndex / 1.71)
    ];

    const labelDescriptions = {
        'LOC': '코드 라인 수 (Lines of Code)',
        'Cyclomatic': '분기 복잡도 (조건문/반복문 수)',
        'CBO': '결합도 (다른 클래스와의 연결 수)',
        'RFC': '응답 메서드 수 (호출 가능한 메서드)',
        'Fan-out': '외부 의존성 (다른 모듈 참조 수)',
        'WMC': '가중 메서드 수 (메서드 복잡도 합)',
        'MI': '유지보수 지수 (높을수록 좋음)'
    };

    const labels = ['LOC', 'Cyclomatic', 'CBO', 'RFC', 'Fan-out', 'WMC', 'MI'];

    metricsRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: '현재 코드',
                data: normalizedData,
                backgroundColor: 'rgba(84, 160, 255, 0.3)',
                borderColor: '#54a0ff',
                borderWidth: 2,
                pointBackgroundColor: '#54a0ff',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            }, {
                label: '권장 기준',
                data: [50, 30, 30, 40, 40, 30, 80],
                backgroundColor: 'rgba(0, 255, 136, 0.1)',
                borderColor: '#00ff88',
                borderWidth: 2,
                borderDash: [5, 5],
                pointBackgroundColor: '#00ff88',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#fff', font: { size: 11 } },
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff', padding: 15, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        title: (context) => labelDescriptions[labels[context[0].dataIndex]] || labels[context[0].dataIndex],
                        label: (context) => {
                            if (context.dataset.label === '현재 코드') {
                                return `실제 값: ${actualValues[context.dataIndex]} (정규화: ${normalizedData[context.dataIndex].toFixed(1)})`;
                            }
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });
}

function renderComplexityDoughnutChart(extended) {
    const ctx = document.getElementById('complexityDoughnutChart').getContext('2d');

    const labelDescriptions = {
        'Cyclomatic': '분기 복잡도 - 조건문과 반복문의 수',
        'CBO': '결합도 - 다른 클래스와의 연결 정도',
        'LCOM': '응집도 부족 - 클래스 내부 연관성 부족',
        'WMC': '가중 메서드 수 - 전체 메서드 복잡도'
    };

    const actualValues = [extended.cyclomatic, extended.cbo, extended.lcom, extended.wmc];

    complexityDoughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cyclomatic', 'CBO', 'LCOM', 'WMC'],
            datasets: [{
                data: [extended.cyclomatic, extended.cbo, extended.lcom, extended.wmc / 2],
                backgroundColor: [
                    'rgba(255, 107, 107, 0.9)',
                    'rgba(254, 202, 87, 0.9)',
                    'rgba(72, 219, 251, 0.9)',
                    'rgba(255, 159, 243, 0.9)'
                ],
                borderColor: '#1a1a2e',
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff', padding: 10, font: { size: 10 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        title: (context) => labelDescriptions[context[0].label] || context[0].label,
                        label: (context) => `실제 값: ${actualValues[context.dataIndex]}`
                    }
                }
            }
        }
    });
}

function renderMetricsBarChart(extended) {
    const ctx = document.getElementById('metricsBarChart').getContext('2d');

    const labelDescriptions = {
        'LOC': '코드 라인 수 (Lines of Code)',
        'RFC': '응답 메서드 수 (Response For Class)',
        'Fan-out': '외부 의존성 (다른 모듈 참조 수)',
        'Halstead V': '할스테드 볼륨 (코드 크기 측정)',
        'MI': '유지보수 지수 (Maintainability Index)'
    };

    const actualValues = [
        extended.loc, extended.rfc, extended.fanOut,
        extended.halsteadVolume, extended.maintainabilityIndex
    ];

    metricsBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['LOC', 'RFC', 'Fan-out', 'Halstead V', 'MI'],
            datasets: [{
                data: [
                    extended.loc, extended.rfc, extended.fanOut,
                    extended.halsteadVolume / 10, extended.maintainabilityIndex
                ],
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(84, 160, 255, 0.4)');
                    gradient.addColorStop(1, 'rgba(255, 107, 107, 0.8)');
                    return gradient;
                },
                borderColor: 'rgba(255, 255, 255, 0.3)',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#fff', font: { size: 10 } } },
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#888' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (context) => labelDescriptions[context[0].label] || context[0].label,
                        label: (context) => `실제 값: ${actualValues[context.dataIndex]}`
                    }
                }
            }
        }
    });
}