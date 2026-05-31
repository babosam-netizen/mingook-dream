const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/ExecutiveTab.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Replace roleBasedDraftUnits and collaborativeDraftUnits with draftUnits
code = code.replace(/const roleBasedDraftUnits = useMemo\(\(\) => \{[\s\S]*?\}, \[.*?\]\)/, '');
code = code.replace(/const collaborativeDraftUnits = useMemo\(\(\) => \{[\s\S]*?\}, \[.*?\]\)/, `const draftUnits = useMemo(() => {
    if (previewMode || exeUnits.length === 0) return []
    if (role === 'teacher') return exeUnits
    if (role === 'student' && myGroupId && (isRoleStep || isBudgetStep)) {
      return exeUnits.filter((unit) => unit.groupId === myGroupId)
    }
    return []
  }, [previewMode, exeUnits, role, myGroupId, isRoleStep, isBudgetStep])`);

// 2. Remove roleBasedDraftUnits mapping and replace with draftUnits mapping, but we will move it down.
// We will remove the top BranchUnitWorkspace render entirely.
code = code.replace(/\{\/\* === 부서 단위 작업 공간 — exeUnits 설정 시에만 표시 === \*\/\}([\s\S]*?)<\/BranchUnitWorkspace>\s*<\/div>\s*<\/div>\s*\)\)\}/, '');

// 3. Replace the entire budgetRef area with a unified render
const budgetRefRegex = /\{\/\* === ② 예산편성 및 시행령 작성 영역 — 항상 budgetRef wrapper === \*\/\}([\s\S]*?)\{\/\* === ③ 예산 초안 검토 — 정부 총예산 대비 부처별 청구액 전광판 === \*\/\}/;
const newBudgetRef = `{/* === ② 예산편성 및 시행령 작성 영역 — 항상 budgetRef wrapper === */}
      <div ref={budgetRef} className="scroll-mt-4">
        <HighlightBox active={!anyHL || isBudgetStep} anyHighlight={anyHL} scrollBlock="start">
          <section className="bg-violet-50/50 border-2 border-violet-300 rounded-2xl p-4">
            <h2 className="text-lg font-bold text-violet-900 mb-3 flex items-baseline gap-2">
              <span className="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full">②</span>
              {isCollaborativeExecutive ? '공동 정책·시행령·예산 템플릿 작성' : '정책 초안 작성'}
            </h2>
            <p className="text-xs text-violet-800 mb-3">
              {isCollaborativeExecutive 
                ? '🤝 공동작업 모드는 역할별 초안 없이 부처 구성원이 함께 상의하며 아래 템플릿을 완성합니다.' 
                : '🎭 장관 또는 공동작업 모둠원이 법률 집행계획, 시행령 초안, 예산안을 작성합니다.'}
            </p>

            {draftUnits.length > 0 ? (
              <div className="space-y-4">
                {draftUnits.map((unit) => (
                  <div key={unit.unitId} className="border-2 border-amber-200 rounded-2xl overflow-hidden bg-white">
                    <div className="bg-amber-100 px-4 py-2 flex items-center gap-2">
                      <span className="text-sm font-bold text-amber-800">
                        🇰🇷 {unit.ministryName || groups?.[unit.groupId]?.name || unit.groupId}
                        {!isCollaborativeExecutive && (
                          <span className="ml-2 text-amber-600 font-normal text-xs">장관: {unit.representativeStudentId || '미지정'}</span>
                        )}
                      </span>
                    </div>
                    <div className="p-4">
                      <BranchUnitWorkspace
                        unitId={unit.unitId}
                        branch="executive"
                        isCollaborative={isCollaborativeExecutive}
                        renderCustomSectionEditor={(key, sec, onSave, saving, myNoteText) => (
                          <ExecutiveSectionEditor
                            sectionKey={key}
                            sec={sec}
                            onSave={onSave}
                            saving={saving}
                            groupId={unit.groupId}
                            passedBills={passedBills}
                            myNoteText={myNoteText}
                          />
                        )}
                        renderCustomSectionViewer={(key, sec) => (
                          <ExecutiveSectionViewer sectionKey={key} sec={sec} />
                        )}
                        renderCustomFinalEditor={(sections, finalDoc, onSaveDraft, saving, onPublishSubmit, allSectionsDone) => (
                          <ExecutiveFinalAssembler
                            sections={sections}
                            finalDoc={finalDoc}
                            onSaveDraft={onSaveDraft}
                            saving={saving}
                            onPublishSubmit={onPublishSubmit}
                            allSectionsDone={allSectionsDone}
                            groupId={unit.groupId}
                          />
                        )}
                        renderCustomFinalViewer={(finalDoc) => (
                          <ExecutiveFinalViewer finalDoc={finalDoc} />
                        )}
                        onPublish={async (publishedData) => {
                          if (!roomCode) return
                          await setAt(roomCode, \`policies/\${unit.groupId}\`, {
                            ministryName: unit.ministryName || '',
                            groupId: unit.groupId,
                            authorStudentId: unit.representativeStudentId,
                            status: 'submitted',
                            branchUnitId: unit.unitId,
                            submittedAt: Date.now(),
                            ...publishedData,
                          })
                        }}
                      >
                        <ExecutivePolicyBudgetDraft groupId={unit.groupId} />
                      </BranchUnitWorkspace>
                    </div>
                  </div>
                ))}
              </div>
            ) : previewMode ? (
              <div className="bg-white border border-violet-200 rounded-xl p-4 text-xs text-gray-600">
                👩‍🏫 학생 화면에서는 장관(또는 모둠원)이 예산편성과 시행령을 작성합니다.
              </div>
            ) : (
              <p className="text-sm text-gray-500">모둠 가입이 필요해요.</p>
            )}
          </section>
        </HighlightBox>
      </div>

      {/* === ③ 예산 초안 검토 — 정부 총예산 대비 부처별 청구액 전광판 === */}`;
code = code.replace(budgetRefRegex, newBudgetRef);

fs.writeFileSync(path, code);
