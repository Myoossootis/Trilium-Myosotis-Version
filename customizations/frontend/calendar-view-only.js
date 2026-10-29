/* Native calendar is for browsing dates; never create journal notes on date clicks. */
(() => {
    window.MyoCalendarViewOnly?.dispose();
    function selectDate(event) {
        const cell=event.target.closest?.('.calendar-dropdown-widget .calendar-date');
        if(!cell)return;
        event.preventDefault();event.stopImmediatePropagation();
        const calendar=cell.closest('.calendar-dropdown-widget');
        calendar.querySelectorAll('.calendar-date-active').forEach(item=>item.classList.remove('calendar-date-active'));
        cell.classList.add('calendar-date-active');
    }
    document.addEventListener('click',selectDate,true);
    window.MyoCalendarViewOnly={dispose(){document.removeEventListener('click',selectDate,true);}};
})();
