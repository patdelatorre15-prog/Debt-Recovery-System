function renderDashboard(){
  header(
    'Your financial month',
    'See what needs attention and where your money is going.'
  );

  const debtDue = state.debts
    .filter(d => d.dueDate.startsWith(MONTH))
    .reduce((sum, debt) => sum + debt.payment, 0);

  const paid = Math.abs(
    activitiesFor('debt')
      .filter(
        activity =>
          activity.type === 'payment' &&
          activity.date.startsWith(MONTH)
      )
      .reduce((sum, activity) => sum + activity.amount, 0)
  );

  const unpaid =
    Math.max(debtDue - paid, 0) +
    state.bills.reduce(
      (sum, bill) =>
        sum + Math.max(bill.actual - Number(bill.paid || 0), 0),
      0
    );

  const attention = state.attention || [];

  const attentionHtml = attention.length
    ? `
      <div class="attention-grid">
        ${attention.map((item, index) => `
          <div class="attention-item ${
            index % 2 ? 'attention-separator' : ''
          }">
            <span class="attention-code">${h(item[0])}</span>

            <div>
              <span class="row-title">${h(item[1])}</span>
              <span class="row-subtitle">${h(item[2])}</span>
            </div>

            <span class="amount">${money(item[3])} ›</span>
          </div>
        `).join('')}
      </div>
    `
    : `
      <div class="empty">
        Nothing needs attention right now.
      </div>
    `;

  const allocatedThisMonth = category =>
    activitiesFor(category)
      .filter(
        activity =>
          activity.type === 'allocation' &&
          activity.date.startsWith(MONTH)
      )
      .reduce(
        (sum, activity) => sum + Math.max(0, activity.amount),
        0
      );

  const allocationHtml = state.allocations
    .map(allocation => `
      <div class="allocation-row">
        <div>
          <span>
            ${h(allocation.name)} · ${allocation.percentage}%
          </span>

          <b>${money(allocatedThisMonth(allocation.key))}</b>
        </div>

        ${track(allocation.percentage, 100)}
      </div>
    `)
    .join('');

  /*
   * Forecast period:
   * Today through the next 29 days, for a total of 30 days.
   */
  const forecastEndDate =
    new Date(`${TODAY}T00:00:00+08:00`);

  forecastEndDate.setDate(
    forecastEndDate.getDate() + 29
  );

  const forecastEnd =
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(forecastEndDate);

  const fallsInsideForecast = date =>
    Boolean(date) &&
    date >= TODAY &&
    date <= forecastEnd;

  /*
   * Overdue obligations are included because they are
   * still required within the forecast period.
   */
  const isDueWithinForecast = date =>
    !date || date <= forecastEnd;

  /*
   * Expected income remains planning only.
   * Received income is not included here.
   */
  const expectedItems = state.expected.filter(
    income =>
      income.status === 'Expected' &&
      fallsInsideForecast(income.date)
  );

  const expectedIncome = expectedItems.reduce(
    (sum, income) => sum + Number(income.amount || 0),
    0
  );

  /*
   * Use the current actual bill amount when available.
   * Subtract anything already paid.
   */
  const billObligations = state.bills
    .filter(
      bill =>
        bill.status !== 'Paid' &&
        isDueWithinForecast(bill.dueOn)
    )
    .reduce(
      (sum, bill) =>
        sum +
        Math.max(
          Number(bill.actual || 0) -
          Number(bill.paid || 0),
          0
        ),
      0
    );

  /*
   * Include active debt payments due during the period.
   * Payments already recorded this month reduce what
   * remains required.
   */
  const scheduledDebt = state.debts
    .filter(
      debt =>
        debt.status !== 'Paid' &&
        isDueWithinForecast(debt.dueDate)
    )
    .reduce(
      (sum, debt) =>
        sum + Number(debt.payment || 0),
      0
    );

  const debtObligations =
    Math.max(scheduledDebt - paid, 0);

  const requiredObligations =
    billObligations + debtObligations;

  /*
   * This follows the clearer old forecast:
   *
   * Expected Income
   * minus Required Obligations
   * equals Projected Position
   */
  const projectedPosition =
    expectedIncome - requiredObligations;

  const forecastMessage =
    projectedPosition < 0
      ? `
        <div class="warning-box">
          <b>
            Forecast shortfall ·
            ${money(Math.abs(projectedPosition))}
          </b>
          may still need funding.
        </div>
      `
      : `
        <div class="recovery-message">
          <b>
            Forecast surplus ·
            ${money(projectedPosition)}
          </b>
          remains after required obligations.
        </div>
      `;

  const forecastHtml = `
    <div class="grid-3">
      ${metric(
        'EXPECTED INCOME',
        money(expectedIncome),
        `From ${expectedItems.length} income ${
          expectedItems.length === 1
            ? 'record'
            : 'records'
        }`,
        'positive'
      )}

      ${metric(
        'REQUIRED OBLIGATIONS',
        money(requiredObligations),
        'Overdue/unpaid bills and debt due in this period'
      )}

      ${metric(
        'PROJECTED POSITION',
        money(projectedPosition),
        projectedPosition < 0
          ? 'Projected shortfall'
          : 'Projected surplus',
        projectedPosition < 0
          ? 'negative'
          : 'positive'
      )}
    </div>

    ${forecastMessage}
  `;

  app.innerHTML = `
    <div class="metrics">
      ${metric(
        'Available this month',
        money(
          Object.values(state.funds)
            .reduce((sum, amount) => sum + amount, 0)
        ),
        'Across all categories',
        'positive'
      )}

      ${metric(
        'Due this month',
        money(debtDue),
        'Scheduled debt payments'
      )}

      ${metric(
        'Paid this month',
        money(paid),
        'Debt payments recorded',
        'positive'
      )}

      ${metric(
        'Unpaid this month',
        money(unpaid),
        'Bills and debt still due',
        'negative'
      )}
    </div>

    ${card(
      'Needs attention',
      attentionHtml,
      `
        <button
          type="button"
          class="link-button"
          data-action="attention-all"
        >
          View all →
        </button>
      `
    )}

    ${card(
      'Forecast',
      forecastHtml,
      pill(
        `30 Days · ${shortDate(TODAY)} – ` +
        `${shortDate(forecastEnd)}`
      ),
      'See what’s coming before it becomes due. ' +
      'Expected income remains planning only.'
    )}

    <div class="grid-2">
      ${card(
        'Monthly allocation',
        allocationHtml,
        `
          <button
            type="button"
            class="link-button"
            data-page="income"
          >
            Manage in Income →
          </button>
        `,
        'Current percentages apply only to future income'
      )}

      ${recoverySnapshotCard()}
    </div>

    ${card(
      'Wins & milestones',
      winsHtml(),
      `
        <button
          type="button"
          class="link-button"
          data-page="recovery"
        >
          View Recovery →
        </button>
      `
    )}

    ${activitySection('', 'Recent activity')}
  `;
}
